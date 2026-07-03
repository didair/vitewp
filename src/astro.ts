import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

export interface ViteWpAstroOptions {
  configFile?: string;
}

export default function vitewp(_options: ViteWpAstroOptions = {}): AstroIntegration {
  return {
    name: 'vitewp',
    hooks: {
      'astro:config:setup': ({ command, addDevToolbarApp, logger }) => {
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

function getDevToolbarEntrypoint() {
  const sourceEntrypoint = new URL('./dev-toolbar/vitewp-toolbar.ts', import.meta.url);

  if (existsSync(fileURLToPath(sourceEntrypoint))) {
    return sourceEntrypoint;
  }

  return new URL('./dev-toolbar/vitewp-toolbar.js', import.meta.url);
}
