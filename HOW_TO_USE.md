# 🚀 How to Use Claude Code with Multi-Agent Mode
## Beginner's Guide for EduSheet AI

---

## What is Claude Code?

Claude Code is a command-line tool where Claude acts as your AI developer.
Instead of chatting in a browser, you type commands in your terminal and
Claude reads your files, writes code, and runs commands — all automatically.

Think of it like having a developer sitting at your keyboard.

---

## Step 1 — Install Claude Code

Open your terminal (on Mac: press Cmd+Space → type "Terminal" → Enter)

```bash
# Install Claude Code globally
npm install -g @anthropic-ai/claude-code

# Verify it installed correctly
claude --version
```

If you see a version number, you're good. ✅

---

## Step 2 — Get Your Anthropic API Key

1. Go to → https://console.anthropic.com
2. Sign in (or create a free account)
3. Click "API Keys" in the left sidebar
4. Click "Create Key" → give it a name like "edusheet-ai"
5. Copy the key (it starts with `sk-ant-...`)
6. Keep it safe — you only see it once!

---

## Step 3 — Set Up the Project

```bash
# Create your project folder
mkdir edusheet-ai
cd edusheet-ai

# Initialize a git repo
git init

# Set your API key (Mac/Linux)
export ANTHROPIC_API_KEY=sk-ant-your-key-here

# Set your API key (Windows)
set ANTHROPIC_API_KEY=sk-ant-your-key-here
```

---

## Step 4 — Add the Multi-Agent File (THE IMPORTANT STEP)

The `CLAUDE.md` file is what makes Claude Code understand the multi-agent
system. Claude Code reads this file automatically every time it starts.

```bash
# Copy the CLAUDE.md file you downloaded into your project root
cp /path/to/CLAUDE.md ./CLAUDE.md

# Your folder should now look like:
# edusheet-ai/
# └── CLAUDE.md    ← Claude Code reads this automatically
```

That's it! The file is the "brain" of your multi-agent system.

---

## Step 5 — Start Claude Code

```bash
# Make sure you're in your project folder
cd edusheet-ai

# Start Claude Code
claude
```

You'll see a prompt like this:
```
Welcome to Claude Code!
Working directory: /Users/yourname/edusheet-ai
>
```

You're now talking directly to Claude as your AI agent team! 🎉

---

## Step 6 — Your First Commands

Copy and paste these commands ONE AT A TIME. Wait for Claude to finish
each one before sending the next.

### Command 1 — Set up the project
```
Initialize the edusheet-ai Node.js project. Create package.json with
all dependencies from REQUIREMENTS.md, create .env.example, .gitignore,
and the full src/ folder structure. Use Node ESM modules.
```

### Command 2 — Build the curriculum data
```
Act as the DBA agent. Build src/ai/topics.js with a complete
grade-to-subject-to-topics mapping for all grades 1-10, covering
Math, ELA, Science, Social Studies, and Health. Align all topics
to CCSS and NGSS standards.
```

### Command 3 — Build the AI engine
```
Act as the DEV agent. Build src/ai/client.js, src/ai/promptBuilder.js,
and src/ai/generator.js. The generator must call the Anthropic Claude API,
enforce JSON-only response using the worksheet schema, validate the schema,
and retry up to 3 times on failure with exponential backoff.
```

### Command 4 — Build the HTML exporter
```
Act as the DEV agent. Build src/exporters/htmlExporter.js and
src/templates/worksheet.html.js. The HTML must be self-contained with
inline CSS, have a print-ready @media print stylesheet, and produce
a clean US Letter layout with school logo placeholder, student name
field, date field, and proper footer.
```

### Command 5 — Build the PDF exporter
```
Act as the DEV agent. Build src/exporters/pdfExporter.js using Puppeteer.
Convert the HTML from htmlExporter to PDF. Use US Letter paper size
(8.5 x 11 inches), 1 inch margins, and print background colors enabled.
Return the PDF as a Buffer.
```

### Command 6 — Build the DOCX exporter
```
Act as the DEV agent. Build src/exporters/docxExporter.js using the
docx npm package. US Letter size (12240x15840 DXA), Arial font,
1-inch margins. The answer key must be generated as a completely
separate .docx file.
```

### Command 7 — Build the CLI
```
Act as the DEV agent. Build src/cli/prompts.js using Inquirer with all
prompts: grade (1-10), subject, topic (dynamic based on grade+subject),
difficulty, question count (5/10/15/20/25/30), answer key yes/no, format
(PDF/DOCX/HTML/All), optional student name, output directory.
Wire everything together in index.js.
```

### Command 8 — Write all tests
```
Act as the QA agent. Write all unit tests in tests/unit/ and integration
tests in tests/integration/ using Jest. Create the fixture file at
tests/fixtures/sampleWorksheet.json. Mock the Anthropic API in unit tests.
Target 80%+ coverage. Run the tests and fix any failures.
```

### Command 9 — Write the README
```
Act as the BA agent. Write a comprehensive README.md for the
github.com/arbabazmi/edusheet-ai repository. Include: project description,
prerequisites, installation steps, usage examples for interactive and
batch mode, the grade/subject coverage table, a contributing section,
and MIT license badge. Format it for GitHub with proper markdown.
```

### Command 10 — Final test run
```
Run npm test and npm start. Fix any errors found. Do a final check
that PDF, DOCX, and HTML all generate correctly for a Grade 3 Math
Multiplication Medium difficulty 10-question worksheet. Show me the
output file paths.
```

---

## How to Use the Multi-Agent System Day-to-Day

Once the project is built, here's how to use each agent for ongoing work:

### Adding a New Feature (e.g. Spanish language support)

```
# Step 1 — Ask BA to write the spec first
"Act as the BA agent. Write a feature spec for adding Spanish language
worksheet support. Include user stories, acceptance criteria, and edge cases."

# Step 2 — Ask DBA to update schemas
"Act as the DBA agent. Update the worksheet JSON schema and CURRICULUM
mapping in topics.js to support a 'language' field for Spanish/English."

# Step 3 — Ask DEV to build it
"Act as the DEV agent. Implement Spanish language support based on
the BA spec and DBA schema updates."

# Step 4 — Ask QA to test it
"Act as the QA agent. Write tests for Spanish language support and
verify all acceptance criteria from the BA spec are met."
```

### Fixing a Bug

```
"Act as the QA agent. The PDF exporter is cutting off the last question
on page 1 of a 20-question worksheet. Investigate the Puppeteer settings,
write a regression test that reproduces the bug, then act as DEV to fix it."
```

### Checking Code Quality

```
"Act as the QA agent. Run the full test suite, check coverage,
and give me a report of any files below 80% coverage."
```

### Updating Curriculum Data

```
"Act as the DBA agent. Add 'Personal Finance' as a Grade 9 and 10
Math topic in topics.js. Align it to relevant financial literacy
standards."
```

---

## Useful Claude Code Tips for Beginners

### Tip 1 — You can ask Claude to read files first
```
Read the file src/ai/generator.js and explain what it does.
```

### Tip 2 — You can ask Claude to fix errors automatically
```
I ran npm test and got this error: [paste the error here]. Fix it.
```

### Tip 3 — You can run real terminal commands through Claude
```
Run npm install and tell me if there are any warnings.
```

### Tip 4 — Claude remembers your project in a session
Within one Claude Code session, Claude remembers what files it has
written and read. If you close and reopen Claude Code, start with:
```
Read the CLAUDE.md and REQUIREMENTS.md files to understand this project,
then tell me what has been built so far.
```

### Tip 5 — If Claude makes a mistake, just correct it
```
That's not right. The PDF should use US Letter size, not A4.
Please fix src/exporters/pdfExporter.js.
```

### Tip 6 — Ask Claude to explain before it codes
```
Before writing any code, explain your plan for building the batch mode feature.
```

---

## Pushing to GitHub

```bash
# Link your local project to your GitHub repo
git remote add origin https://github.com/arbabazmi/edusheet-ai.git

# Add all files
git add .

# First commit
git commit -m "feat: initial project setup with multi-agent CLAUDE.md"

# Push to GitHub
git push -u origin main
```

Your project will be live and publicly downloadable at:
https://github.com/arbabazmi/edusheet-ai

---

## Quick Reference Card

| I want to...             | Say to Claude Code...                                    |
|--------------------------|----------------------------------------------------------|
| Add a new feature        | "Act as BA agent. Write spec for [feature]."             |
| Write code               | "Act as DEV agent. Implement [feature] per spec."        |
| Test something           | "Act as QA agent. Write tests for [module]."             |
| Update data/schema       | "Act as DBA agent. Update the curriculum for [grade]."   |
| Fix a bug                | "Act as QA then DEV. Find and fix bug in [module]."      |
| Understand the code      | "Read [filename] and explain what it does."              |
| Run the app              | "Run npm start and show me the output."                  |
| Check test coverage      | "Run npm run test:coverage and summarize."               |

---

## File Checklist — What You Should Have

```
edusheet-ai/
├── CLAUDE.md           ← The multi-agent brain (from this package)
├── REQUIREMENTS.md     ← Full project requirements (from this package)
├── HOW_TO_USE.md       ← This guide (from this package)
├── package.json        ← Created by Claude Code (Step 6, Command 1)
├── .env.example        ← Created by Claude Code
├── .gitignore          ← Created by Claude Code
├── README.md           ← Created by Claude Code (Command 9)
└── src/                ← Created by Claude Code (Commands 2-7)
```

---

## Support

If Claude Code gives an error:
1. Copy the full error message
2. Paste it back to Claude: "I got this error: [paste]. Fix it."
3. Claude will diagnose and fix automatically

If you're stuck at any step, just say:
"I'm stuck on step [X]. Here's what happened: [describe]. Help me continue."

Happy building! 🎓
