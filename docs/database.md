# Database configuration

ViteWP should use a bring-your-own-database model by default, just like WordPress.

The default runtime should start PHP/WordPress and Astro, but it should not assume ownership of MySQL or MariaDB. Teams can use whatever database they already prefer: local MySQL, MariaDB, DBngin, Homebrew services, DDEV/Lando databases, a shared dev database, or a containerized database.

## Configuration

Database settings live in `vitewp.config.ts` and can be sourced from environment variables:

```ts
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
});
```

## Environment variables

ViteWP loads `.env` files before reading `vitewp.config.ts`, so `process.env.WP_DB_*` values are available inside config. Real `.env` files should stay local and out of git; commit `.env.example` instead.


The recommended names mirror WordPress conventions:

```bash
WP_DB_HOST=127.0.0.1
WP_DB_PORT=3306
WP_DB_NAME=vitewp
WP_DB_USER=root
WP_DB_PASSWORD=
WP_DB_TABLE_PREFIX=wp_
```

## Doctor checks

`vitewp doctor` validates that database settings are present and printable without requiring a Node database driver. Later versions can add optional connection checks, but the first goal is to keep the core dependency-light and not force one database package on every project.
