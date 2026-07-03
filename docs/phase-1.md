# Phase 1 completion

Phase 1 proves the core ViteWP loop: this project is the local WordPress instance, and Astro renders the frontend through one unified development origin.

## Completed capabilities

- `vitewp dev` starts Composer-managed WordPress, PHP, Astro, and the ViteWP proxy.
- `vitewp doctor` validates the local project setup.
- `vitewp smoke` verifies the running dev runtime.
- `vitewp types` generates the first TypeScript metadata layer.
- WordPress core is installed by Composer and pinned to WordPress 7.
- The generated WordPress docroot is ignored by git.
- WordPress uses a ViteWP placeholder theme so wp-admin remains healthy.
- WordPress admin, REST, media, `wp-content`, Astro pages, and Vite HMR share `http://localhost:3000`.
- Routes are resolved through WordPress bridge endpoints and rendered by Astro templates loaded with `import.meta.glob`.
- Settings → Reading and Settings → Permalinks are respected by the bridge/runtime.
- Pages, posts, front page, posts page, archives, taxonomies, search, 404, pagination, and menus have first-pass support.

## Phase 1 verification

Start the dev runtime:

```bash
npm run dev
```

In another terminal:

```bash
npm run doctor
npm run smoke
npm run types
npm run build
npm run astro:check
```

## Known Phase 1 limitations

- The Astro integration is still minimal and project-local.
- The runtime is development-only.
- Type generation is metadata-first, not full REST schema typing yet.
- WordPress preview/draft flows are not implemented yet.
- Block/plugin asset bundling starts in a later phase.
