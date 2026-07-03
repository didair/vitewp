import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import type { LoadedViteWpConfig } from '../config.js';

export async function ensureComposerInstall(config: LoadedViteWpConfig) {
  if (!config.composer.install) {
    console.log('Composer install disabled by config.');
    return;
  }

  const lockfile = join(config.root, 'composer.lock');
  const vendor = join(config.root, 'vendor');
  const wpSettings = join(config.root, config.wordpress.docroot, 'wp-settings.php');

  if (existsSync(lockfile) && existsSync(vendor) && existsSync(wpSettings)) {
    console.log('✓ Composer dependencies already installed');
    return;
  }

  console.log('Installing Composer dependencies...');
  await runComposerInstall(config.root);
  console.log('✓ Composer dependencies ready');
}

function runComposerInstall(cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('composer', ['install'], {
      cwd,
      stdio: 'inherit',
      env: { ...process.env, COMPOSER_ALLOW_SUPERUSER: process.env.COMPOSER_ALLOW_SUPERUSER ?? '1' },
    });

    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`composer install failed with code ${code ?? 'unknown'}.`));
      }
    });
  });
}
