# Type generation

ViteWP includes a first-pass generated type layer.

Run the dev runtime, then generate types:

```bash
npm run dev
npm run types
```

`vite-wp types` reads WordPress metadata from:

```txt
/wp-json/vitewp/v1/types
```

It writes the configured output file, currently:

```txt
src/wordpress/generated-types.ts
```

The first version generates:

- `WpPostType`
- `WpTaxonomy`
- `WpRestBaseByPostType`
- `WpArchiveSlugByPostType`
- `WpRestBaseByTaxonomy`
- base `WpContentItem` shapes

This is intentionally small. The next iterations should add custom fields, block attributes, richer REST response shapes, and generated route/template context types.
