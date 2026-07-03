import { defineConfig } from './src/index.js';

export default defineConfig({
  database: {
    driver: 'mysql',
    host: process.env.WP_DB_HOST ?? '127.0.0.1',
    port: Number(process.env.WP_DB_PORT ?? 3306),
    name: process.env.WP_DB_NAME ?? 'vitewp',
    user: process.env.WP_DB_USER ?? 'root',
    password: process.env.WP_DB_PASSWORD ?? '',
    tablePrefix: process.env.WP_DB_TABLE_PREFIX ?? 'wp_',
  },
  wordpress: {
    mode: 'local',
    url: 'http://localhost:3000',
    docroot: 'wordpress/public',
    contentDir: 'wordpress/content',
  },
  composer: {
    install: true,
    wordpressPackage: 'johnpbloch/wordpress',
  },
  templates: {
    directory: 'src/templates',
  },
  types: {
    output: 'src/wordpress/generated-types.ts',
  },
  dev: {
    phpHost: process.env.VITEWP_PHP_HOST ?? '127.0.0.1',
    phpPort: Number(process.env.VITEWP_PHP_PORT ?? 8080),
    astroHost: process.env.VITEWP_ASTRO_HOST ?? '127.0.0.1',
    astroPort: Number(process.env.VITEWP_ASTRO_PORT ?? 4321),
  },
});
