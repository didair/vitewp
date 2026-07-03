import { loadViteWpConfig } from '../config.js';
import { ensureComposerInstall } from '../runtime/composer.js';
import { startAstroServer, stopAstroServer } from '../runtime/astro.js';
import { startPhpServer } from '../runtime/php.js';
import { waitForExit } from '../runtime/process.js';
import { assertPortAvailable } from '../runtime/ports.js';
import { startUnifiedProxy } from '../runtime/proxy.js';
import { phpServerUrl, writeWordPressConfig } from '../runtime/wp-config.js';
import { runDoctorChecks } from './doctor.js';

export async function runDev() {
  const config = await loadViteWpConfig();

  console.log('ViteWP dev runtime');
  console.log(`- public URL: ${config.wordpress.url}`);
  console.log(`- WordPress URL: ${phpServerUrl(config)}`);
  console.log(`- Astro URL: http://${config.dev.astroHost}:${config.dev.astroPort}`);
  console.log(`- WordPress docroot: ${config.wordpress.docroot}`);
  console.log(`- WordPress content: ${config.wordpress.contentDir}`);
  console.log(`- templates: ${config.templates.directory}`);
  console.log(`- database: ${config.database.driver}://${config.database.user}@${config.database.host}:${config.database.port}/${config.database.name}`);
  console.log('');

  const result = await runDoctorChecks(config);

  if (result.errors > 0) {
    console.log('');
    console.log('Fix the errors above before starting the dev runtime.');
    process.exitCode = 1;
    return;
  }

  process.env.VITEWP_PUBLIC_URL = config.wordpress.url;
  process.env.VITEWP_PHP_URL = phpServerUrl(config);

  try {
    await ensureComposerInstall(config);
    writeWordPressConfig(config);
    await stopAstroServer(config);
    await assertPortAvailable(config.dev.phpHost, config.dev.phpPort, 'WordPress/PHP');
    await assertPortAvailable(config.dev.astroHost, config.dev.astroPort, 'Astro');
    const publicUrl = new URL(config.wordpress.url);
    await assertPortAvailable(publicUrl.hostname, Number(publicUrl.port || 3000), 'ViteWP proxy');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
    return;
  }

  console.log('');
  console.log(`✓ WordPress/PHP starting at ${phpServerUrl(config)}`);
  console.log(`✓ Astro starting at http://${config.dev.astroHost}:${config.dev.astroPort}`);

  const php = startPhpServer(config);
  const astro = await startAstroServer(config);
  const proxy = await startUnifiedProxy(config);

  console.log(`✓ Unified ViteWP proxy running at ${proxy.url}`);
  console.log('Press Ctrl+C to stop.');
  console.log('');

  await waitForExit([php, astro]);
  await proxy.stop();
}
