import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  private?: boolean;
  scripts?: Record<string, string>;
  type?: string;
  [key: string]: unknown;
}

export function runInit() {
  const target = resolve(process.cwd(), getTargetDirectory());
  const force = process.argv.includes('--force');
  const shouldInstall = !process.argv.includes('--no-install');
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const starter = resolve(packageRoot, 'starter');

  if (!existsSync(starter)) {
    console.error('Could not find the ViteWP starter files in this package.');
    process.exitCode = 1;
    return;
  }

  mkdirSync(target, { recursive: true });
  copyDirectory(starter, target, force);
  updatePackageJson(target, packageRoot);
  ensureGitignore(target);

  console.log(`ViteWP project files initialized in ${relative(process.cwd(), target) || '.'}.`);

  if (shouldInstall) {
    installDependencies(target);
  }

  console.log('');
  console.log('Next steps:');
  console.log('  1. Copy .env.example to .env and set database credentials.');
  console.log('  2. Run npm run dev.');
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

function updatePackageJson(root: string, packageRoot: string) {
  const file = join(root, 'package.json');
  const packageJson: PackageJson = existsSync(file)
    ? JSON.parse(readFileSync(file, 'utf8')) as PackageJson
    : { private: true, type: 'module' };
  const viteWp = readOwnPackage(packageRoot);

  packageJson.type ??= 'module';
  packageJson.scripts ??= {};
  packageJson.dependencies ??= {};
  packageJson.devDependencies ??= {};
  packageJson.scripts.dev ??= 'vite-wp dev';
  packageJson.scripts.doctor ??= 'vite-wp doctor';
  packageJson.scripts.types ??= 'vite-wp types';
  packageJson.scripts.composer ??= 'vite-wp composer';
  packageJson.scripts.wp ??= 'vite-wp wp';
  packageJson.scripts.check ??= 'astro check';
  packageJson.dependencies['vite-wp'] ??= `^${viteWp.version}`;
  packageJson.dependencies.astro ??= '^7.0.6';
  packageJson.devDependencies.typescript ??= '~6.0.2';
  packageJson.devDependencies['@astrojs/check'] ??= '^0.9.9';

  writeFileSync(file, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
}

function ensureGitignore(root: string) {
  const file = join(root, '.gitignore');

  if (existsSync(file)) {
    return;
  }

  writeFileSync(file, renderGitignore(), 'utf8');
}

function renderGitignore() {
  return `# Dependencies
node_modules/
vendor/

# Environment
.env
.env.*
!.env.example

# Build output
dist/
dist-ssr/

# ViteWP generated/runtime files
.vitewp/
.astro/
wordpress/public/
wordpress/content/mu-plugins/vitewp-bridge.php
wordpress/content/themes/vitewp/
wordpress/content/uploads/
wordpress/content/debug.log

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
pnpm-debug.log*

# Editor and OS files
.DS_Store
.idea/
.vscode/*
!.vscode/extensions.json
`;
}

function readOwnPackage(packageRoot: string) {
  const file = join(packageRoot, 'package.json');
  const packageJson = JSON.parse(readFileSync(file, 'utf8')) as { version?: string };
  return { version: packageJson.version ?? '0.1.0' };
}

function installDependencies(root: string) {
  const packageManager = detectPackageManager();
  const args = packageManager === 'yarn' ? [] : ['install'];

  console.log('');
  console.log(`Installing dependencies with ${packageManager}...`);

  const result = spawnSync(packageManager, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    console.log('');
    console.log(`Dependency install did not complete. Run ${packageManager} ${args.join(' ')} manually.`.trim());
  }
}

function detectPackageManager() {
  const userAgent = process.env.npm_config_user_agent ?? '';

  if (userAgent.startsWith('pnpm')) return 'pnpm';
  if (userAgent.startsWith('yarn')) return 'yarn';
  if (userAgent.startsWith('bun')) return 'bun';
  return 'npm';
}
