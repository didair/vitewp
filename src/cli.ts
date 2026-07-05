#!/usr/bin/env node
import { runDev } from './commands/dev.js';
import { runDoctor } from './commands/doctor.js';
import { runSmoke } from './commands/smoke.js';
import { runTypes } from './commands/types.js';
import { runInit } from './commands/init.js';

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
  console.log(`vitewp\n\nUsage:\n  vitewp init      Copy starter project files into the current directory
  vitewp dev       Start the local WordPress + Astro development runtime
  vitewp doctor    Check the current project setup
  vitewp types     Generate TypeScript types from WordPress metadata
  vitewp smoke     Verify the running ViteWP dev runtime\n`);
}
