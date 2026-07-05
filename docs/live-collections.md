# Astro Live Collections

ViteWP uses Astro Live Collections as the framework-level data API for WordPress reads.

The runtime still belongs to ViteWP: PHP startup, Composer-installed WordPress, the unified proxy, WordPress admin/API/media routing, previews, and template hierarchy are not moved into collections. Live Collections are the template-facing data layer.

## Default collections

The prototype defines `src/live.config.ts` with these collections:

- `routes` — resolves a URL path through WordPress and returns the ViteWP route payload.
- `posts` — loads WordPress posts from the REST API.
- `pages` — loads WordPress pages from the REST API.
- `menus` — loads menus from the ViteWP bridge endpoint.

## Usage in templates

```ts
import { getLiveEntry, getLiveCollection } from 'astro:content';

const route = await getLiveEntry('routes', { path: Astro.url.pathname });
const posts = await getLiveCollection('posts', { page: 1, perPage: 10 });
const primaryMenu = await getLiveEntry('menus', { location: 'primary' });
```

The catch-all WordPress route now uses the `routes` live collection before selecting an Astro template.

## Package loaders

ViteWP exposes reusable loaders from `vite-wp/content` for future generated projects:

```ts
import { defineLiveCollection } from 'astro:content';
import { wpMenuLoader, wpPostTypeLoader, wpRouteLoader } from 'vite-wp/content';

export const collections = {
  routes: defineLiveCollection({ loader: wpRouteLoader() }),
  posts: defineLiveCollection({ loader: wpPostTypeLoader({ postType: 'post', restBase: 'posts' }) }),
  menus: defineLiveCollection({ loader: wpMenuLoader() }),
};
```

In this monorepo prototype, `src/live.config.ts` imports the same loaders from local source so development works before the package is published.

## Diagnostics

The Astro dev toolbar now shows the live collection used for the current route. Later it can also show loader timings, cache hints, WordPress REST endpoints, and validation errors.
