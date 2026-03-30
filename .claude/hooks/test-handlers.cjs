#!/usr/bin/env node
// PostToolUse hook (async): runs npm test when a handler or solve file is edited
const PROJECT_ROOT = 'C:/arbab-github/edusheet-ai';

let d = '';
process.stdin.resume();
process.stdin.on('data', c => d += c);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(d);
    const f = ((input.tool_input || {}).file_path || '').replace(/\\/g, '/');
    if (!f || !/(backend\/handlers|src\/solve)\/.*\.js$/.test(f)) return;

    const name = f.split('/').pop();
    const projectRoot = PROJECT_ROOT;

    const { execSync } = require('child_process');
    try {
      const out = execSync('npm test', {
        cwd: projectRoot,
        stdio: 'pipe',
        timeout: 90000
      }).toString();
      const summary = out.split('\n')
        .filter(l => /Tests:|passed|failed|PASS |FAIL /.test(l))
        .slice(-4).join(' | ');
      process.stdout.write(JSON.stringify({
        systemMessage: `🧪 Tests after editing ${name}: ${summary || 'all passed'}`
      }) + '\n');
    } catch (e) {
      const all = ((e.stdout || '') + (e.stderr || '')).toString();
      const summary = all.split('\n')
        .filter(l => /FAIL |Tests:|failed/.test(l))
        .slice(-4).join(' | ');
      process.stdout.write(JSON.stringify({
        systemMessage: `✗ Tests failed after editing ${name}: ${summary}`
      }) + '\n');
    }
  } catch (_) {}
});
