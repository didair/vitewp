import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function runInit() {
  const target = resolve(process.cwd(), getTargetDirectory());
  const force = process.argv.includes('--force');
  const starter = resolve(dirname(fileURLToPath(import.meta.url)), '../../starter');

  if (!existsSync(starter)) {
    console.error('Could not find the ViteWP starter files in this package.');
    process.exitCode = 1;
    return;
  }

  mkdirSync(target, { recursive: true });
  copyDirectory(starter, target, force);
  updatePackageJson(target);

  console.log(`ViteWP project files initialized in ${relative(process.cwd(), target) || '.'}.`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Copy .env.example to .env and set database credentials.');
  console.log('  2. Run npm install if dependencies are not installed yet.');
  console.log('  3. Run npm run dev.');
}

function getTargetDirectory() {
  const positional = process.argv.slice(3).find((arg) => !arg.startsWith('-'));
  return positional ?? '.';
}

function copyDirectory(from: string, to: string, force: boolean) {
  for (const entry of readdirSync(from)) {
    const source = join(from, entry);
    const destination = join(to, entry);
    const stats = statSync(source);

    if (stats.isDirectory()) {
      mkdirSync(destination, { recursive: true });
      copyDirectory(source, destination, force);
      continue;
    }

    if (existsSync(destination) && !force) {
      continue;
    }

    cpSync(source, destination, { force: true });
  }
}

function updatePackageJson(root: string) {
  const file = join(root, 'package.json');
  const packageJson = existsSync(file)
    ? JSON.parse(readFileSync(file, 'utf8')) as Record<string, any>
    : { private: true, type: 'module' };

  packageJson.type ??= 'module';
  packageJson.scripts ??= {};
  packageJson.scripts.dev ??= 'vitewp dev';
  packageJson.scripts.doctor ??= 'vitewp doctor';
  packageJson.scripts.types ??= 'vitewp types';
  packageJson.scripts.check ??= 'astro check';

  writeFileSync(file, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
}
