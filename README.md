# ViteWP

ViteWP is an Astro-first WordPress development framework prototype.

The goal is simple: a ViteWP project **is** the local WordPress site. One command starts Composer-installed WordPress, PHP, Astro, the dev proxy, typed WordPress data helpers, and the Astro template layer.

```bash
npm run dev
```

Then use one URL:

```txt
http://localhost:3000
```

WordPress admin, REST, media, Astro routes, Vite HMR, and template rendering all work through that unified origin. The internal PHP and Astro servers are implementation details.

## Requirements

- Node.js 20+
- PHP 8.2+
- Composer
- MySQL or MariaDB database

ViteWP is bring-your-own database. It does not start MySQL for you.

## Current status

This is an early prototype. It is not published to npm yet, so testing it in another project currently means installing it from this local repository or a packed tarball.

## Try ViteWP in another project

From this repository, build and pack the local package:

```bash
cd /Users/didair/proj/vitewp
npm install
npm run build
npm pack
```

Create a test project somewhere else:

```bash
mkdir my-vitewp-site
cd my-vitewp-site
npm init -y
npm install astro typescript @astrojs/check ../vitewp/vitewp-0.0.0.tgz
```

Add scripts:

```bash
npm pkg set type=module
npm pkg set scripts.dev="vitewp dev"
npm pkg set scripts.doctor="vitewp doctor"
npm pkg set scripts.types="vitewp types"
npm pkg set scripts.check="astro check"
```

Copy the current starter files from this prototype:

```bash
# From inside my-vitewp-site
cp /Users/didair/proj/vitewp/composer.json ./composer.json
cp /Users/didair/proj/vitewp/.env.example ./.env.example
mkdir -p src wordpress/content
cp -R /Users/didair/proj/vitewp/src/pages ./src/pages
cp -R /Users/didair/proj/vitewp/src/templates ./src/templates
cp -R /Users/didair/proj/vitewp/src/wordpress ./src/wordpress
cp -R /Users/didair/proj/vitewp/wordpress/content/mu-plugins ./wordpress/content/mu-plugins
cp -R /Users/didair/proj/vitewp/wordpress/content/themes ./wordpress/content/themes
```

Create `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import vitewp from 'vitewp/astro';

export default defineConfig({
  output: 'server',
  integrations: [vitewp()],
  vite: {
    server: {
      ws: {
        protocol: 'ws',
        host: 'localhost',
        clientPort: 3000,
      },
    },
  },
});
```

Create `vitewp.config.ts`:

```ts
import { defineConfig } from 'vitewp';

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
});
```

Create `src/live.config.ts`:

```ts
import { defineLiveCollection } from 'astro:content';
import { wpMenuLoader, wpPostTypeLoader, wpRouteLoader } from 'vitewp/content';

export const collections = {
  routes: defineLiveCollection({
    loader: wpRouteLoader(),
  }),
  posts: defineLiveCollection({
    loader: wpPostTypeLoader({ postType: 'post', restBase: 'posts' }),
  }),
  pages: defineLiveCollection({
    loader: wpPostTypeLoader({ postType: 'page', restBase: 'pages' }),
  }),
  menus: defineLiveCollection({
    loader: wpMenuLoader(),
  }),
};
```

Create `src/env.d.ts`:

```ts
/// <reference types="astro/client" />
```

Update `tsconfig.json` or create one:

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "src"]
}
```

Create `.env` from `.env.example` and set your database credentials:

```bash
cp .env.example .env
```

Then start ViteWP:

```bash
npm run dev
```

Open:

```txt
http://localhost:3000
```

Go to `/wp-admin/` to finish WordPress installation if the database is empty.

## Commands

```bash
npm run dev      # Start WordPress/PHP, Astro, and the unified ViteWP proxy
npm run doctor   # Check PHP, Composer, WordPress files, config, and environment
npm run types    # Generate basic WordPress-derived TypeScript types
npm run check    # Run Astro type checking
```

For internal diagnostics:

```bash
npm run dev -- --verbose
```

That prints the internal PHP and Astro URLs. Normal development should only use `http://localhost:3000`.

## Folder structure

```txt
my-vitewp-site/
  astro.config.mjs
  vitewp.config.ts
  composer.json
  .env

  src/
    live.config.ts              # Astro Live Collections for WordPress data
    env.d.ts
    pages/
      [...slug].astro           # Catch-all WordPress route rendered by Astro
    templates/
      pages/
        front-page.astro
        default.astro
      posts/
        single.astro
        archive.astro
      taxonomies/
        taxonomy-[taxonomy].astro
      search.astro
      404.astro
    wordpress/
      client.ts                 # WordPress REST/bridge helpers
      templates.ts              # Template hierarchy resolver
      menus.ts
      generated-types.ts

  wordpress/
    public/                     # Composer-installed WordPress core; ignored by git
    content/
      mu-plugins/
        vitewp-bridge.php       # ViteWP WordPress bridge
      themes/
        vitewp/                 # Tiny placeholder theme to keep WordPress happy
      plugins/
      uploads/
```

## Template basics

The catch-all route asks WordPress what a URL means, then picks the first matching Astro template.

Examples:

```txt
src/templates/pages/front-page.astro
src/templates/pages/page-about.astro
src/templates/pages/default.astro
src/templates/posts/single.astro
src/templates/posts/archive.astro
src/templates/taxonomies/category.astro
src/templates/taxonomies/taxonomy-[taxonomy].astro
src/templates/search.astro
src/templates/404.astro
```

## Live Collections

ViteWP uses Astro Live Collections as the WordPress data layer:

```ts
import { getLiveCollection, getLiveEntry } from 'astro:content';

const route = await getLiveEntry('routes', { path: '/' });
const posts = await getLiveCollection('posts', { page: 1, perPage: 10 });
const menu = await getLiveEntry('menus', { location: 'primary' });
```

After `astro check` or `npm run dev`, collection names and filters should have TypeScript completion.

## Notes

- WordPress core is installed by Composer into `wordpress/public`.
- Do not commit `wordpress/public`, `.env`, `.vitewp`, or uploads.
- The placeholder theme exists only to satisfy WordPress admin/theme requirements.
- Docker is optional; it is not required for the default ViteWP workflow.
