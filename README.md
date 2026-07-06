# ViteWP

ViteWP is an Astro-first WordPress development framework.

One entrypoint for everything you need, no fuzz and no magic.

## Requirements

- Node.js 20+
- PHP 8.2+
- Composer
- a MySQL or MariaDB server

## Get started

```bash
mkdir my-site
cd my-site
npm init -y
npx vite-wp init
cp .env.example .env
```

`vite-wp init` creates the starter files, adds the needed package dependencies, and runs install.

Edit `.env` with your database credentials, run `npm run dev`, wait for the initial configuration and then open:

```txt
http://localhost:3000
```

If the database is empty, go to `/wp-admin/` and complete the WordPress installer.

## Commands

```bash
npm run dev      # Start the local ViteWP runtime
npm run doctor   # Check PHP, Composer, WordPress, config, and environment
npm run types    # Generate WordPress-derived TypeScript types
npm run check    # Run Astro type checking
```

For internal runtime diagnostics:

```bash
npm run dev -- --verbose
```

## Folder structure

```txt
my-site/
  astro.config.mjs
  vitewp.config.ts
  composer.json
  .env

  src/
    live.config.ts
    templates/             # optional template overrides

  wordpress/
    public/              # Composer-installed WordPress core
    content/
      mu-plugins/
      themes/
      plugins/
      uploads/
```

## Templates

ViteWP ships default templates from the package. Create files in `src/templates` only when you want to override them.

Examples:

```txt
src/templates/pages/front-page.astro
src/templates/pages/page-about.astro
src/templates/posts/single.astro
src/templates/posts/archive.astro
src/templates/taxonomies/category.astro
src/templates/search.astro
src/templates/404.astro
```

## WordPress data

ViteWP uses Astro Live Collections for WordPress data:

```ts
import { getLiveCollection, getLiveEntry } from 'astro:content';

const route = await getLiveEntry('routes', { path: '/' });
const posts = await getLiveCollection('posts', { page: 1, perPage: 10 });
const menu = await getLiveEntry('menus', { location: 'primary' });
```

After `npm run dev` or `npm run check`, collection names and filters should have TypeScript completion.
