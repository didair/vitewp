# Distribution and update model

ViteWP should integrate like a real project dependency, not like copied boilerplate that becomes impossible to update.

## Recommended model

A ViteWP project should contain project-owned files and install the reusable system through packages:

- `vitewp` npm package: CLI, Astro integration, template resolver, type generation, dev proxy, block/plugin bundler.
- Composer packages: pinned WordPress core, PHP bridge/mu-plugin, optional WordPress plugins.
- Project files: templates, components, config, content-specific code, and overrides.

Generated projects can take up real space, but updateable behavior should live in versioned packages whenever possible.

## Update boundaries

Files that should usually be updated by package upgrades:

- CLI commands
- Astro integration
- WordPress bridge runtime
- template resolver
- proxy/dev orchestration
- type generators
- block/plugin bundler

Files that belong to the user project:

- `vitewp.config.ts`
- `astro.config.mjs`
- `composer.json`
- `src/templates/**`
- `src/components/**`
- `src/blocks/**`
- `src/wp-plugin/**`

## Update command goal

A future command should make framework updates explicit:

```bash
vitewp upgrade
```

It should report available npm and Composer updates, explain breaking changes, and avoid overwriting user templates without a clear diff.
