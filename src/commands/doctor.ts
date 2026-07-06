import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadViteWpConfig, type LoadedViteWpConfig } from '../config.js';

const execFileAsync = promisify(execFile);

type CheckStatus = 'pass' | 'warn' | 'fail';

interface Check {
  status: CheckStatus;
  label: string;
  detail?: string;
}

export async function runDoctor() {
  const config = await loadViteWpConfig();
  const result = await runDoctorChecks(config);
  process.exitCode = result.errors > 0 ? 1 : 0;
}

export async function runDoctorChecks(config: LoadedViteWpConfig, options: { live?: boolean } = {}) {
  const live = options.live ?? true;
  const checks: Check[] = [];

  checks.push({
    status: config.configFile ? 'pass' : 'warn',
    label: 'ViteWP config',
    detail: config.configFile ?? 'No vitewp.config.* file found; using defaults.',
  });

  checks.push(fileCheck(config.root, 'astro.config.mjs', 'Astro config'));
  checks.push(fileCheck(config.root, 'composer.json', 'Composer manifest'));
  checks.push(composerWordPressCheck(config.root, config.composer.wordpressPackage));
  checks.push(composerInstallDirCheck(config));
  checks.push(fileCheck(config.root, 'composer.lock', 'Composer lockfile'));
  checks.push(composerLockCheck(config.root, config.composer.wordpressPackage));
  checks.push(fileCheck(config.root, `${config.wordpress.docroot}/wp-settings.php`, 'Composer-installed WordPress core'));
  checks.push(fileCheck(config.root, `${config.wordpress.docroot}/wp-config.php`, 'Generated wp-config.php'));
  checks.push(fileCheck(config.root, `${config.wordpress.contentDir}/mu-plugins/vitewp-bridge.php`, 'ViteWP bridge mu-plugin'));
  checks.push(fileCheck(config.root, `${config.wordpress.contentDir}/themes/vitewp/style.css`, 'ViteWP placeholder theme'));
  checks.push(templateDirectoryCheck(config));
  checks.push(databaseConfigCheck(config));

  checks.push(await commandCheck('php', ['-v'], 'PHP runtime'));
  checks.push(await commandCheck('composer', ['--version'], 'Composer'));

  checks.push(gitignoreCheck(config.root, config.wordpress.docroot));
  checks.push(runtimeFilesIgnoredCheck(config.root, config.wordpress.contentDir));
  checks.push(...requiredPluginFileChecks(config));
  if (live) {
    checks.push(await wordpressHealthCheck(config));
  }

  printChecks(checks);

  const errors = checks.filter((check) => check.status === 'fail').length;
  const warnings = checks.filter((check) => check.status === 'warn').length;

  console.log('');
  console.log(`Doctor finished with ${errors} error(s) and ${warnings} warning(s).`);

  return { errors, warnings };
}

function fileCheck(root: string, relativePath: string, label: string): Check {
  const path = join(root, relativePath);
  return existsSync(path)
    ? { status: 'pass', label, detail: relativePath }
    : { status: 'warn', label, detail: `${relativePath} does not exist yet.` };
}

function templateDirectoryCheck(config: LoadedViteWpConfig): Check {
  const directory = join(config.root, config.templates.directory);

  return existsSync(directory)
    ? { status: 'pass', label: 'Project template overrides', detail: config.templates.directory }
    : {
        status: 'pass',
        label: 'Project template overrides',
        detail: `${config.templates.directory} is optional; package defaults will be used.`,
      };
}

async function commandCheck(command: string, args: string[], label: string): Promise<Check> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args);
    const firstLine = `${stdout}${stderr}`.split('\n').find(Boolean);
    return { status: 'pass', label, detail: firstLine };
  } catch {
    return { status: 'fail', label, detail: `${command} was not found on PATH.` };
  }
}

function databaseConfigCheck(config: LoadedViteWpConfig): Check {
  const database = config.database;
  const missing = [
    ['host', database.host],
    ['name', database.name],
    ['user', database.user],
    ['tablePrefix', database.tablePrefix],
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    return {
      status: 'fail',
      label: 'Database config',
      detail: `Missing ${missing.map(([key]) => key).join(', ')}.`,
    };
  }

  if (database.driver !== 'mysql' && database.driver !== 'mariadb') {
    return {
      status: 'fail',
      label: 'Database config',
      detail: `Unsupported driver: ${database.driver}.`,
    };
  }

  return {
    status: 'pass',
    label: 'Database config',
    detail: `${database.driver}://${database.user}@${database.host}:${database.port}/${database.name} (${database.tablePrefix})`,
  };
}

function composerWordPressCheck(root: string, wordpressPackage: string): Check {
  const composerPath = join(root, 'composer.json');

  if (!existsSync(composerPath)) {
    return {
      status: 'warn',
      label: 'Composer WordPress package',
      detail: 'composer.json does not exist yet.',
    };
  }

  try {
    const composer = JSON.parse(readFileSync(composerPath, 'utf8')) as {
      require?: Record<string, string>;
      extra?: { 'wordpress-install-dir'?: string };
    };
    const version = composer.require?.[wordpressPackage];

    if (!version) {
      return {
        status: 'fail',
        label: 'Composer WordPress package',
        detail: `${wordpressPackage} is not declared in composer.json.`,
      };
    }

    const installDir = composer.extra?.['wordpress-install-dir'];
    const installDetail = installDir ? ` -> ${installDir}` : '';

    return {
      status: 'pass',
      label: 'Composer WordPress package',
      detail: `${wordpressPackage}@${version}${installDetail}`,
    };
  } catch (error) {
    return {
      status: 'fail',
      label: 'Composer WordPress package',
      detail: error instanceof Error ? error.message : 'Could not parse composer.json.',
    };
  }
}

function composerInstallDirCheck(config: LoadedViteWpConfig): Check {
  const composerPath = join(config.root, 'composer.json');

  if (!existsSync(composerPath)) {
    return {
      status: 'warn',
      label: 'Composer WordPress install dir',
      detail: 'composer.json does not exist yet.',
    };
  }

  try {
    const composer = JSON.parse(readFileSync(composerPath, 'utf8')) as {
      extra?: { 'wordpress-install-dir'?: string };
    };
    const installDir = composer.extra?.['wordpress-install-dir'];

    if (!installDir) {
      return {
        status: 'warn',
        label: 'Composer WordPress install dir',
        detail: 'extra.wordpress-install-dir is not set.',
      };
    }

    return installDir === config.wordpress.docroot
      ? { status: 'pass', label: 'Composer WordPress install dir', detail: installDir }
      : {
          status: 'fail',
          label: 'Composer WordPress install dir',
          detail: `${installDir} does not match config docroot ${config.wordpress.docroot}.`,
        };
  } catch (error) {
    return {
      status: 'fail',
      label: 'Composer WordPress install dir',
      detail: error instanceof Error ? error.message : 'Could not parse composer.json.',
    };
  }
}

function composerLockCheck(root: string, wordpressPackage: string): Check {
  const lockPath = join(root, 'composer.lock');

  if (!existsSync(lockPath)) {
    return {
      status: 'warn',
      label: 'Locked WordPress version',
      detail: 'Run composer install to create composer.lock.',
    };
  }

  try {
    const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as {
      packages?: Array<{ name?: string; version?: string }>;
    };
    const wordpress = lock.packages?.find((pkg) => pkg.name === wordpressPackage);

    if (!wordpress?.version) {
      return {
        status: 'fail',
        label: 'Locked WordPress version',
        detail: `${wordpressPackage} was not found in composer.lock.`,
      };
    }

    return {
      status: 'pass',
      label: 'Locked WordPress version',
      detail: `${wordpressPackage}@${wordpress.version}`,
    };
  } catch (error) {
    return {
      status: 'fail',
      label: 'Locked WordPress version',
      detail: error instanceof Error ? error.message : 'Could not parse composer.lock.',
    };
  }
}

function gitignoreCheck(root: string, docroot: string): Check {
  const gitignorePath = join(root, '.gitignore');

  if (!existsSync(gitignorePath)) {
    return { status: 'warn', label: 'Generated WordPress ignored', detail: '.gitignore is missing.' };
  }

  const gitignore = readFileSync(gitignorePath, 'utf8');
  const normalizedDocroot = docroot.endsWith('/') ? docroot : `${docroot}/`;

  return gitignore.includes(normalizedDocroot)
    ? { status: 'pass', label: 'Generated WordPress ignored', detail: normalizedDocroot }
    : {
        status: 'warn',
        label: 'Generated WordPress ignored',
        detail: `Add ${normalizedDocroot} to .gitignore.`,
      };
}

function runtimeFilesIgnoredCheck(root: string, contentDir: string): Check {
  const gitignorePath = join(root, '.gitignore');

  if (!existsSync(gitignorePath)) {
    return { status: 'warn', label: 'WordPress runtime files ignored', detail: '.gitignore is missing.' };
  }

  const gitignore = readFileSync(gitignorePath, 'utf8');
  const required = [
    `${contentDir}/uploads/`,
    `${contentDir}/debug.log`,
  ];
  const missing = required.filter((entry) => !gitignore.includes(entry));

  return missing.length === 0
    ? { status: 'pass', label: 'WordPress runtime files ignored', detail: required.join(', ') }
    : {
        status: 'warn',
        label: 'WordPress runtime files ignored',
        detail: `Add ${missing.join(', ')} to .gitignore.`,
      };
}

function requiredPluginFileChecks(config: LoadedViteWpConfig): Check[] {
  return config.wordpress.requiredPlugins.map((plugin) => {
    const directory = `${config.wordpress.contentDir}/plugins/${plugin}`;
    return fileCheck(config.root, directory, `Required plugin files: ${plugin}`);
  });
}

async function wordpressHealthCheck(config: LoadedViteWpConfig): Promise<Check> {
  const url = `${config.wordpress.url.replace(/\/$/, '')}/wp-json/vitewp/v1/health`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      return {
        status: 'warn',
        label: 'WordPress health endpoint',
        detail: `${url} returned ${response.status}. Start vite-wp dev if the runtime is offline.`,
      };
    }

    const health = await response.json() as {
      wordpressVersion?: string;
      phpVersion?: string;
      permalinkStructure?: string;
      activeTheme?: string;
      activePlugins?: string[];
    };
    const missingPlugins = config.wordpress.requiredPlugins.filter((plugin) => {
      return !health.activePlugins?.some((active) => active === plugin || active.startsWith(`${plugin}/`));
    });

    if (missingPlugins.length > 0) {
      return {
        status: 'fail',
        label: 'WordPress health endpoint',
        detail: `Missing active plugin(s): ${missingPlugins.join(', ')}.`,
      };
    }

    return {
      status: 'pass',
      label: 'WordPress health endpoint',
      detail: `WP ${health.wordpressVersion ?? '?'} / PHP ${health.phpVersion ?? '?'} / theme ${health.activeTheme ?? '?'} / permalinks ${health.permalinkStructure || 'plain'}`,
    };
  } catch {
    return {
      status: 'warn',
      label: 'WordPress health endpoint',
      detail: `Could not reach ${url}. Start vite-wp dev to run live health checks.`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function printChecks(checks: Check[]) {
  console.log('ViteWP doctor');
  console.log('');

  for (const check of checks) {
    const icon = check.status === 'pass' ? '✓' : check.status === 'warn' ? '!' : '✕';
    console.log(`${icon} ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
  }
}
