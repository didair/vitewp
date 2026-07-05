# ViteWP

ViteWP is an Astro-first WordPress development framework.

A ViteWP project **is** the local WordPress site: Composer installs WordPress, PHP runs WordPress, Astro renders the frontend, and one local URL serves admin, REST, media, previews, and Astro pages.

```txt
http://localhost:3000
```

PHP and Astro still run internally, but you normally only use the unified ViteWP URL.

## Requirements

- Node.js 20+
- PHP 8.2+
- Composer
- MySQL or MariaDB

ViteWP is bring-your-own database. It does not start MySQL for you.

## Get started

```bash
mkdir my-site
cd my-site
npm init -y
npx vite-wp init
cp .env.example .env
npm run dev
```

`vite-wp init` creates the starter files, adds the needed package dependencies, and runs install.

Edit `.env` with your database credentials, then open:

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
    pages/
      [...slug].astro
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
      client.ts
      templates.ts
      menus.ts
      generated-types.ts

  wordpress/
    public/              # Composer-installed WordPress core
    content/
      mu-plugins/
      themes/
      plugins/
      uploads/
```

## Templates

The catch-all Astro route asks WordPress what the current URL is, then renders the first matching template from `src/templates`.

Examples:

```txt
src/templates/pages/front-page.astro
src/templates/pages/page-about.astro
src/templates/pages/default.astro
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

## Notes

- WordPress core is installed into `wordpress/public` by Composer.
- Do not commit `wordpress/public`, `.env`, `.vitewp`, or uploads.
- The tiny placeholder theme exists only to keep WordPress admin happy.
- Docker is optional, not required.
