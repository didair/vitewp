#!/usr/bin/env node
import { runDev } from './commands/dev.js';
import { runDoctor } from './commands/doctor.js';
import { runSmoke } from './commands/smoke.js';
import { runTypes } from './commands/types.js';
import { runInit } from './commands/init.js';
import { runComposerCommand } from './commands/composer.js';
import { runWpCommand } from './commands/wp.js';

const command = process.argv[2] ?? 'help';

switch (command) {
  case 'dev':
    await runDev();
    break;
  case 'doctor':
    await runDoctor();
    break;
  case 'init':
    runInit();
    break;
  case 'types':
    await runTypes();
    break;
  case 'composer':
    await runComposerCommand();
    break;
  case 'wp':
    await runWpCommand();
    break;
  case 'smoke':
    await runSmoke();
    break;
  case 'help':
  case '--help':
  case '-h':
    printHelp();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exitCode = 1;
}

function printHelp() {
  console.log(`vite-wp\n\nUsage:\n  vite-wp init      Copy starter project files into the current directory
  vite-wp dev       Start the local WordPress + Astro development runtime
  vite-wp doctor    Check the current project setup
  vite-wp types     Generate TypeScript types from WordPress metadata
  vite-wp composer  Run Composer in the ViteWP project
  vite-wp wp        Run WP-CLI for the local WordPress runtime
  vite-wp smoke     Verify the running ViteWP dev runtime

Options:
  vite-wp init --no-install   Create files without running package install\n`);
}
