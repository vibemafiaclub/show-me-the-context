#!/usr/bin/env node
import { listSessions, viewSession, printUsage } from './cli.js';

const args = process.argv.slice(2);
const command = args[0];

if (command === '--help' || command === '-h') {
  printUsage();
  process.exit(0);
}

if (command === 'sessions') {
  const json = args.includes('--json');
  listSessions(json);
  process.exit(0);
}

if (command === 'view') {
  const sessionId = args[1];
  if (!sessionId || sessionId === '--json') {
    console.error('Usage: show-me-the-context view <session-id> [--json]');
    process.exit(1);
  }
  const json = args.includes('--json');
  viewSession(sessionId, json);
  process.exit(0);
}

// Default: launch TUI
import('react').then(async (React) => {
  const { render } = await import('ink');
  const { App } = await import('./ui/App.js');
  render(React.createElement(App));
});
