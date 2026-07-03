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

export async function runDoctorChecks(config: LoadedViteWpConfig) {
  const checks: Check[] = [];

  checks.push({
    status: config.configFile ? 'pass' : 'warn',
    label: 'ViteWP config',
    detail: config.configFile ?? 'No vitewp.config.* file found; using defaults.',
  });

  checks.push(fileCheck(config.root, 'astro.config.mjs', 'Astro config'));
  checks.push(fileCheck(config.root, 'composer.json', 'Composer manifest'));
  checks.push(composerWordPressCheck(config.root, config.composer.wordpressPackage));
  checks.push(fileCheck(config.root, 'composer.lock', 'Composer lockfile'));
  checks.push(fileCheck(config.root, `${config.wordpress.docroot}/wp-settings.php`, 'Composer-installed WordPress core'));
  checks.push(fileCheck(config.root, `${config.wordpress.docroot}/wp-config.php`, 'Generated wp-config.php'));
  checks.push(fileCheck(config.root, `${config.wordpress.contentDir}/themes/vitewp/style.css`, 'ViteWP placeholder theme'));
  checks.push(fileCheck(config.root, config.templates.directory, 'Template directory'));
  checks.push(databaseConfigCheck(config));

  checks.push(await commandCheck('php', ['-v'], 'PHP runtime'));
  checks.push(await commandCheck('composer', ['--version'], 'Composer'));

  checks.push(gitignoreCheck(config.root, config.wordpress.docroot));

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

function printChecks(checks: Check[]) {
  console.log('ViteWP doctor');
  console.log('');

  for (const check of checks) {
    const icon = check.status === 'pass' ? '✓' : check.status === 'warn' ? '!' : '✕';
    console.log(`${icon} ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
  }
}
