import { defineConfig } from 'vite-wp';

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
  blocks: {
    entries: ['src/blocks/**/block.json'],
  },
  plugins: {
    entries: [],
  },
});
