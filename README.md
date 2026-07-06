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
npx vite-wp composer install  # Run Composer in the project
npx vite-wp wp plugin list    # Run WP-CLI when installed
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
      mu-plugins/        # ViteWP bridge is generated here
      themes/            # ViteWP placeholder theme is generated here
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

## WordPress hooks in Astro

Astro templates can ask the internal WordPress runtime to render real WordPress actions and filters during SSR:

```astro
---
import { createHooks } from 'vite-wp/wordpress/hooks';

const hooks = createHooks(Astro.props);
const head = await hooks.action('wp_head');
const content = await hooks.filter('the_content', Astro.props.content);
---

<Fragment set:html={head.rendered} />
<article set:html={content.value} />
```

## Blocks and plugin assets

ViteWP discovers block metadata from `src/blocks/**/block.json` and bundles WordPress-side TypeScript/CSS.

```txt
src/blocks/hero/block.json
src/blocks/hero/edit.tsx
src/blocks/hero/style.css
```
