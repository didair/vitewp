import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { loadViteWpConfig, type LoadedViteWpConfig } from '../config.js';

export async function runWpCommand(args = process.argv.slice(3)) {
  const config = await loadViteWpConfig();
  const command = wpBinary(config);

  if (!command) {
    console.error('Could not find WP-CLI. Install it globally as `wp` or add it to Composer.');
    process.exitCode = 1;
    return;
  }

  const wpArgs = [
    `--path=${config.wordpress.docroot}`,
    `--url=${config.wordpress.url}`,
    ...args,
  ];

  const code = await spawnWp(config, command, wpArgs);
  process.exitCode = code;
}

function wpBinary(config: LoadedViteWpConfig) {
  const local = join(config.root, 'vendor/bin/wp');

  if (existsSync(local)) {
    return local;
  }

  return process.platform === 'win32' ? 'wp.cmd' : 'wp';
}

function spawnWp(config: LoadedViteWpConfig, command: string, args: string[]) {
  return new Promise<number>((resolve) => {
    const child = spawn(command, args, {
      cwd: config.root,
      stdio: 'inherit',
      env: process.env,
    });

    child.once('exit', (code) => resolve(code ?? 1));
    child.once('error', (error) => {
      console.error(`Could not run WP-CLI (${command}). ${error.message}`);
      resolve(1);
    });
  });
}
