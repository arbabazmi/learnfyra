/**
 * @file src/utils/logger.js
 * @description Colored console output utilities for the CLI
 * @agent DEV
 */

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';

export const logger = {
  /**
   * Prints the EduSheet AI banner on startup
   */
  banner() {
    console.log(`\n${BOLD}${CYAN}╔═══════════════════════════════════════╗
║       📚 EduSheet AI v1.0             ║
║   AI-Powered Worksheet Generator     ║
╚═══════════════════════════════════════╝${RESET}\n`);
  },

  /**
   * Logs an informational message (blue)
   * @param {string} msg
   */
  info(msg) {
    console.log(`${BLUE}ℹ ${msg}${RESET}`);
  },

  /**
   * Logs a success message (green)
   * @param {string} msg
   */
  success(msg) {
    console.log(`${GREEN}✓ ${msg}${RESET}`);
  },

  /**
   * Logs a warning message (yellow)
   * @param {string} msg
   */
  warn(msg) {
    console.warn(`${YELLOW}⚠ ${msg}${RESET}`);
  },

  /**
   * Logs an error message (red)
   * @param {string} msg
   */
  error(msg) {
    console.error(`${RED}✗ ${msg}${RESET}`);
  },

  /**
   * Logs a debug message (dim) — only if DEBUG env var is set
   * @param {string} msg
   */
  debug(msg) {
    if (process.env.DEBUG) {
      console.log(`\x1b[2m[DEBUG] ${msg}${RESET}`);
    }
  },
};
