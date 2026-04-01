#!/usr/bin/env node
// PostToolUse hook: runs node --check on any .js file after Write/Edit
// Converts Git Bash /c/ paths to Windows C:/ paths for execSync
let d = '';
process.stdin.resume();
process.stdin.on('data', c => d += c);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(d);
    const f = (input.tool_input || {}).file_path || '';
    if (!f || !/\.js$/.test(f)) return;

    // Convert /c/foo/bar → C:/foo/bar for Windows execSync
    const winPath = f.replace(/^\/([a-zA-Z])\//, (_, l) => l.toUpperCase() + ':/');
    const name = f.split(/[\\/]/).pop();

    const { execSync } = require('child_process');
    try {
      execSync(`node --check "${winPath}"`, { stdio: 'pipe' });
      process.stdout.write(JSON.stringify({
        systemMessage: `✓ Syntax OK: ${name}`
      }) + '\n');
    } catch (e) {
      const raw = e.stderr ? e.stderr.toString() : e.message;
      const detail = raw.split('\n').filter(Boolean).slice(0, 2).join(' ');
      process.stdout.write(JSON.stringify({
        systemMessage: `✗ Syntax error in ${name}: ${detail}`
      }) + '\n');
    }
  } catch (_) {}
});
