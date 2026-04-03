<#
.SYNOPSIS
    Learnfyra Release & Tag Script (Conventional Commits / Semver)
.DESCRIPTION
    Merges the current PR into main, auto-detects the semver bump from
    Conventional Commit messages, creates a tag, and publishes a GitHub release.

    Follows: https://www.conventionalcommits.org/en/v1.0.0/
    Follows: https://semver.org/

    Commit analysis rules:
      BREAKING CHANGE / feat!: / fix!:  -->  MAJOR
      feat: / feat(scope):              -->  MINOR
      fix: / chore: / docs: / etc.      -->  PATCH

    Requires: git, gh (GitHub CLI) - both must be authenticated.

.USAGE
    .\scripts\release.ps1                     # auto-detect PR + auto-detect bump
    .\scripts\release.ps1 -PRNumber 66        # specify PR number
    .\scripts\release.ps1 -Version "1.2.0"    # explicit version override
    .\scripts\release.ps1 -BumpType minor     # force bump type (skip auto-detect)
    .\scripts\release.ps1 -DryRun             # preview without making changes
    .\scripts\release.ps1 -NoConfirm          # skip confirmation prompt
#>

param(
    [int]$PRNumber = 0,
    [string]$Version = "",
    [ValidateSet("major", "minor", "patch", "")]
    [string]$BumpType = "",
    [switch]$NoConfirm,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# ── Helpers ────────────────────────────────────────────────────────────────
function Write-Step  ($msg) { Write-Host "[*] $msg" -ForegroundColor Cyan }
function Write-Ok    ($msg) { Write-Host "[+] $msg" -ForegroundColor Green }
function Write-Warn  ($msg) { Write-Host "[!] $msg" -ForegroundColor Yellow }
function Write-Err   ($msg) { Write-Host "[-] $msg" -ForegroundColor Red }

function Get-SemverFromTag ([string]$tag) {
    if ($tag -match "^v?(\d+)\.(\d+)\.(\d+)$") {
        return @{ Major = [int]$Matches[1]; Minor = [int]$Matches[2]; Patch = [int]$Matches[3] }
    }
    return $null
}

# ── Conventional Commit Analyzer ───────────────────────────────────────────
# Parses commit messages and returns the highest bump level detected.
# Follows: https://www.conventionalcommits.org/en/v1.0.0/
function Get-BumpFromCommits ([string[]]$commits) {
    $bump = "patch"  # default

    foreach ($msg in $commits) {
        # MAJOR: breaking change indicator
        # - "BREAKING CHANGE:" or "BREAKING-CHANGE:" anywhere in the message
        # - "type!:" or "type(scope)!:" prefix (e.g. feat!:, fix(api)!:)
        if ($msg -match "BREAKING[ -]CHANGE" -or $msg -match "^\w+(\(.+\))?!:") {
            return "major"
        }

        # MINOR: new feature
        if ($msg -match "^feat(\(.+\))?:") {
            $bump = "minor"
        }

        # PATCH (already default): fix, chore, docs, style, refactor, perf, test, ci, build
    }

    return $bump
}

# ── Pre-flight checks ─────────────────────────────────────────────────────
Write-Step "Running pre-flight checks..."

foreach ($tool in @("git", "gh")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Err "$tool is not installed or not in PATH."
        exit 1
    }
}

$ghAuth = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err "GitHub CLI is not authenticated. Run 'gh auth login' first."
    exit 1
}

# Ensure we're on a clean working tree (ignore untracked)
try {
    $dirtyFiles = git diff --name-only HEAD 2>&1
    if ($dirtyFiles -and ($dirtyFiles | Where-Object { $_ -notmatch '^warning:' })) {
        Write-Warn "Working tree has uncommitted changes. Proceeding anyway..."
    }
} catch {
    # Ignore git warnings about CRLF etc.
}

Write-Ok "Pre-flight passed."

# ── Detect PR ──────────────────────────────────────────────────────────────
if ($PRNumber -eq 0) {
    Write-Step "Detecting PR from current branch..."
    $currentBranch = git rev-parse --abbrev-ref HEAD
    $prJson = gh pr view $currentBranch --json number,title,state,headRefName,baseRefName 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Err "No PR found for branch '$currentBranch'. Specify -PRNumber manually."
        exit 1
    }
    $pr = $prJson | ConvertFrom-Json
    $PRNumber = $pr.number
} else {
    $prJson = gh pr view $PRNumber --json number,title,state,headRefName,baseRefName
    $pr = $prJson | ConvertFrom-Json
}

$prTitle = $pr.title
$prState = $pr.state
$prHead  = $pr.headRefName
$prBase  = $pr.baseRefName

Write-Ok "PR #${PRNumber}: $prTitle"
Write-Host "    Branch: $prHead -> $prBase"
Write-Host "    State:  $prState"

if ($prState -eq "MERGED") {
    Write-Warn "PR is already merged. Skipping merge step."
}

# ── Resolve latest semver tag ──────────────────────────────────────────────
Write-Step "Determining version..."

git fetch --tags --quiet 2>$null

$tags = git tag --list "v*" --sort=-version:refname 2>$null
$latestTag = $tags | Where-Object { $_ -match "^v\d+\.\d+\.\d+$" } | Select-Object -First 1

if ($latestTag) {
    $sv = Get-SemverFromTag $latestTag
    $major = $sv.Major; $minor = $sv.Minor; $patch = $sv.Patch
    Write-Host "    Latest tag: $latestTag (v$major.$minor.$patch)"
} else {
    Write-Warn "No semver tags found. Starting from v0.0.0."
    $major = 0; $minor = 0; $patch = 0
    $latestTag = $null
}

# ── Determine next version ─────────────────────────────────────────────────
if ($Version -ne "") {
    # Explicit override
    $nextVersion = $Version.TrimStart("v")
    $detectedBump = "explicit"
} elseif ($BumpType -ne "") {
    # Forced bump type
    $detectedBump = $BumpType
} else {
    # Auto-detect from conventional commits since last tag
    Write-Step "Analyzing commits (Conventional Commits spec)..."

    if ($latestTag) {
        $commitMsgs = git log "$latestTag..HEAD" --format="%s" --no-merges 2>$null
    } else {
        $commitMsgs = git log --format="%s" --no-merges 2>$null
    }

    if (-not $commitMsgs) {
        $commitMsgs = @($prTitle)
        Write-Warn "No commits found since last tag. Using PR title for analysis."
    }

    if ($commitMsgs -is [string]) { $commitMsgs = @($commitMsgs) }

    $detectedBump = Get-BumpFromCommits $commitMsgs

    # Show what was detected
    Write-Host ""
    Write-Host "    Commits analyzed: $($commitMsgs.Count)" -ForegroundColor DarkGray
    $commitMsgs | Select-Object -First 10 | ForEach-Object {
        $prefix = if ($_ -match "^(\w+)(\(.+?\))?(!)?\s*:") { $Matches[0] } else { "non-conventional" }
        Write-Host "      $prefix  $_" -ForegroundColor DarkGray
    }
    if ($commitMsgs.Count -gt 10) {
        Write-Host "      ... and $($commitMsgs.Count - 10) more" -ForegroundColor DarkGray
    }
    Write-Host ""
    Write-Ok "Auto-detected bump: $($detectedBump.ToUpper())"
}

# Apply bump
if ($Version -eq "") {
    switch ($detectedBump) {
        "major" { $major++; $minor = 0; $patch = 0 }
        "minor" { $minor++; $patch = 0 }
        "patch" { $patch++ }
    }
    $nextVersion = "$major.$minor.$patch"
}

$tag = "v$nextVersion"
Write-Ok "Next version: $tag"

# Validate tag doesn't exist
$existingTag = git tag --list $tag
if ($existingTag) {
    Write-Err "Tag $tag already exists. Use -Version to specify a different version."
    exit 1
}

# ── Generate changelog from commits ────────────────────────────────────────
Write-Step "Generating changelog..."

$breaking = @(); $features = @(); $fixes = @(); $other = @()

$allMsgs = if ($latestTag) {
    git log "$latestTag..HEAD" --format="%s" --no-merges 2>$null
} else {
    git log --format="%s" --no-merges 2>$null
}
if ($allMsgs -is [string]) { $allMsgs = @($allMsgs) }
if (-not $allMsgs) { $allMsgs = @($prTitle) }

foreach ($msg in $allMsgs) {
    if ($msg -match "BREAKING[ -]CHANGE" -or $msg -match "^\w+(\(.+\))?!:") {
        $breaking += $msg
    } elseif ($msg -match "^feat(\(.+\))?:") {
        $features += $msg
    } elseif ($msg -match "^fix(\(.+\))?:") {
        $fixes += $msg
    } else {
        $other += $msg
    }
}

$changelogLines = @()
if ($breaking.Count -gt 0) {
    $changelogLines += "### BREAKING CHANGES"
    $breaking | ForEach-Object { $changelogLines += "- $_" }
    $changelogLines += ""
}
if ($features.Count -gt 0) {
    $changelogLines += "### Features"
    $features | ForEach-Object { $changelogLines += "- $_" }
    $changelogLines += ""
}
if ($fixes.Count -gt 0) {
    $changelogLines += "### Bug Fixes"
    $fixes | ForEach-Object { $changelogLines += "- $_" }
    $changelogLines += ""
}
if ($other.Count -gt 0) {
    $changelogLines += "### Other Changes"
    $other | ForEach-Object { $changelogLines += "- $_" }
    $changelogLines += ""
}

$changelog = $changelogLines -join "`n"

Write-Host $changelog -ForegroundColor DarkGray

# ── Summary & Confirm ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "=============================================" -ForegroundColor Magenta
Write-Host "  RELEASE SUMMARY" -ForegroundColor Magenta
Write-Host "=============================================" -ForegroundColor Magenta
Write-Host "  PR:       #${PRNumber} - $prTitle"
Write-Host "  Bump:     $($detectedBump.ToUpper())"
Write-Host "  Version:  $latestTag -> $tag"
Write-Host "  Target:   $prBase"
if ($DryRun) {
    Write-Host "  Mode:     DRY RUN (no changes will be made)" -ForegroundColor Yellow
}
Write-Host "=============================================" -ForegroundColor Magenta
Write-Host ""

if ($DryRun) {
    Write-Warn "Dry run complete. No changes made."
    exit 0
}

if (-not $NoConfirm) {
    $confirm = Read-Host "Proceed with release? (y/N)"
    if ($confirm -notin @("y", "Y", "yes")) {
        Write-Warn "Aborted."
        exit 0
    }
}

# ── Merge PR ──────────────────────────────────────────────────────────────
if ($prState -ne "MERGED") {
    Write-Step "Merging PR #${PRNumber} (squash)..."
    gh pr merge $PRNumber --squash --delete-branch
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to merge PR. Check CI status and branch protections."
        exit 1
    }
    Write-Ok "PR merged and branch deleted."
}

# ── Update local main ────────────────────────────────────────────────────
Write-Step "Updating local $prBase branch..."
git checkout $prBase
git pull origin $prBase --quiet

# ── Create annotated tag ─────────────────────────────────────────────────
Write-Step "Creating annotated tag $tag..."
$tagMsg = "Release $tag`n`nPR #${PRNumber}: $prTitle`n`n$changelog"
git tag -a $tag -m $tagMsg
git push origin $tag
Write-Ok "Tag $tag pushed to origin."

# ── Create GitHub Release ────────────────────────────────────────────────
Write-Step "Creating GitHub release..."

# Write changelog to temp file for the release body
$tempFile = [System.IO.Path]::GetTempFileName()
$releaseBody = "## What's Changed`n`n$changelog`n`n**Full Changelog**: https://github.com/$((gh repo view --json nameWithOwner -q '.nameWithOwner'))/compare/$latestTag...$tag"
$releaseBody | Out-File -FilePath $tempFile -Encoding utf8

gh release create $tag --title "Release $tag" --notes-file $tempFile --latest
Remove-Item $tempFile -ErrorAction SilentlyContinue

if ($LASTEXITCODE -ne 0) {
    Write-Err "Failed to create release. Create it manually:"
    Write-Host "  gh release create $tag --title 'Release $tag' --generate-notes"
    exit 1
}

$repoUrl = gh repo view --json url -q ".url"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  RELEASE COMPLETE" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  Tag:      $tag"
Write-Host "  Release:  $repoUrl/releases/tag/$tag"
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
