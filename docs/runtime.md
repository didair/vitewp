# Development runtime

The first ViteWP runtime milestone starts WordPress/PHP and Astro side-by-side.

```bash
npm run dev
```

The command currently:

1. loads `vitewp.config.ts`,
2. runs `vitewp doctor`,
3. runs `composer install` when WordPress core is missing,
4. generates `wordpress/public/wp-config.php` from ViteWP database settings,
5. starts PHP's built-in server for WordPress,
6. starts Astro's dev server,
7. starts the unified ViteWP proxy on the only developer-facing port.

Default developer URL:

- Local site: `http://localhost:3000`

WordPress/PHP and Astro still run as separate local processes, but their listeners are internal implementation details. By default ViteWP binds them to `127.0.0.1` and auto-selects available ports. The CLI only prints those internal URLs when run with `--verbose` or `VITEWP_VERBOSE=1`.

The proxy routes WordPress admin/API/media/PHP requests to WordPress and all other frontend page requests to Astro, so the browser only needs the unified local site URL.

## Database

ViteWP remains bring-your-own-database. The generated `wp-config.php` uses the `database` section from `vitewp.config.ts` or the `WP_DB_*` environment variables documented in `.env.example`.


## Why ViteWP owns the proxy

Vite has useful dev-server proxy support, but ViteWP needs the proxy to be a product-level runtime boundary, not just a frontend dev-server feature. The proxy must make one local origin serve WordPress admin, REST, media, PHP entrypoints, Astro pages, and Astro/Vite HMR. Owning this small proxy directly gives ViteWP predictable routing, header rewriting, redirect rewriting, and a path to production-like preview behavior.


## WordPress content rendering

The Astro catch-all route now asks WordPress what a URL means through the ViteWP bridge endpoint, then renders the response with glob-loaded Astro templates:

- `/` respects Settings → Reading and renders either the static front page or latest posts.
- `/sample-page` resolves as a WordPress page.
- `/hello-world` resolves as a WordPress post.
- Custom post type singles resolve through WordPress permalink lookup.
- Custom post type archives resolve when the post type has an archive.

Resolved pages use the first matching glob-loaded template from:

1. `src/templates/pages/page-{slug}.astro`
2. `src/templates/pages/default.astro`

Resolved posts use the first matching glob-loaded template from:

1. `src/templates/posts/single-{slug}.astro`
2. `src/templates/posts/single.astro`

This is the first thin slice of the future WordPress template hierarchy.


Custom post type templates use:

1. `src/templates/post-types/{postType}/single-{slug}.astro`
2. `src/templates/post-types/{postType}/single.astro`
3. `src/templates/posts/single.astro`

Custom post type archive templates use:

1. `src/templates/post-types/{postType}/archive.astro`
2. `src/templates/posts/archive.astro`

Template debug metadata is only emitted in Astro dev mode.


## Astro dev toolbar

During `vitewp dev`, the Astro dev toolbar gets a ViteWP panel. Open it on any Astro-rendered frontend route to inspect:

- the selected ViteWP template,
- the WordPress route kind,
- post type and slug metadata,
- pagination metadata,
- and the template hierarchy candidates considered for the request.

This gives us a clean home for future route diagnostics without rendering debug panels into the page itself.

The first ViteWP panel also shows the Astro Live Collection used to resolve the current route.


## Permalinks

Frontend route resolution goes through WordPress via the ViteWP bridge endpoint. For singles, the bridge uses WordPress permalink-aware lookup first, then falls back to slug lookup for the current early prototype. This means the frontend should follow Settings → Permalinks as the bridge matures. If permalink settings change, flush/save permalinks in WordPress admin before testing routes.


## Theme-like template routes

ViteWP now covers the first theme-like routing layer:

- front page and posts page respect Settings → Reading,
- posts and pages resolve through WordPress permalink behavior,
- post type archives resolve for public post types with archives,
- taxonomy archives resolve for categories, tags, and public custom taxonomies,
- search resolves at `/search?s=query` or `/search/query`,
- archive pagination resolves with `/page/{number}`,
- 404s render `src/templates/404.astro`,
- menus are available through `src/wordpress/menus.ts`.

Template candidates are glob-loaded from `src/templates` instead of read manually from the filesystem. Taxonomy archives use:

1. `src/templates/taxonomies/{taxonomy}-{term}.astro`
2. `src/templates/taxonomies/{taxonomy}.astro`
3. `src/templates/taxonomies/taxonomy-[taxonomy].astro`
4. `src/templates/posts/archive.astro`

Search uses:

1. `src/templates/search.astro`
2. `src/templates/posts/archive.astro`
