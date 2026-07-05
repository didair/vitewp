import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

export interface ViteWpAstroOptions {
  configFile?: string;
}

export default function vitewp(_options: ViteWpAstroOptions = {}): AstroIntegration {
  return {
    name: 'vitewp',
    hooks: {
      'astro:config:setup': ({ command, config, injectRoute, addDevToolbarApp, logger }) => {
        if (!hasProjectCatchAllRoute(fileURLToPath(config.root))) {
          injectRoute({
            pattern: '/[...slug]',
            entrypoint: getDefaultRouteEntrypoint(),
            prerender: false,
          });
        }

        if (command === 'dev') {
          addDevToolbarApp({
            id: 'vitewp',
            name: 'ViteWP',
            icon: 'sitemap',
            entrypoint: getDevToolbarEntrypoint(),
          });
        }

        logger.info('ViteWP integration loaded.');
      },
    },
  };
}

function hasProjectCatchAllRoute(root: string) {
  return [
    join(root, 'src/pages/[...slug].astro'),
    join(root, 'src/pages/[...slug].ts'),
    join(root, 'src/pages/[...slug].js'),
  ].some((file) => existsSync(file));
}

function getDefaultRouteEntrypoint() {
  const sourceEntrypoint = new URL('../runtime/route.astro', import.meta.url);

  if (existsSync(fileURLToPath(sourceEntrypoint))) {
    return sourceEntrypoint;
  }

  return new URL('../runtime/route.astro', import.meta.url);
}

function getDevToolbarEntrypoint() {
  const sourceEntrypoint = new URL('./dev-toolbar/vitewp-toolbar.ts', import.meta.url);

  if (existsSync(fileURLToPath(sourceEntrypoint))) {
    return sourceEntrypoint;
  }

  return new URL('./dev-toolbar/vitewp-toolbar.js', import.meta.url);
}
