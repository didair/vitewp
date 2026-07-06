import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { build, type InlineConfig } from 'vite';
import type { LoadedViteWpConfig } from '../config.js';

export interface WordPressAssetWatcher {
  stop: () => Promise<void>;
}

interface DiscoveredBlock {
  name: string;
  directory: string;
  metadataFile: string;
  metadata: Record<string, unknown>;
  entries: AssetEntry[];
}

interface AssetEntry {
  id: string;
  source: string;
  kind: 'script' | 'style';
  handle: string;
  dependencies: string[];
  file?: string;
  css?: string[];
}

interface AssetsManifest {
  version: 1;
  blocks: Array<{
    name: string;
    metadataFile: string;
    directory: string;
    entries: AssetEntry[];
  }>;
  plugins: AssetEntry[];
}

interface DiscoveredAssets {
  blocks: DiscoveredBlock[];
  pluginEntries: AssetEntry[];
  entries: AssetEntry[];
}

const blockAssetFields = [
  ['editorScript', 'script'],
  ['script', 'script'],
  ['viewScript', 'script'],
  ['editorStyle', 'style'],
  ['style', 'style'],
] as const;

export async function buildWordPressAssets(
  config: LoadedViteWpConfig,
  options: { mode?: 'development' | 'production' } = {},
) {
  const discovered = discoverAssets(config);

  if (discovered.entries.length === 0) {
    return { blocks: [], plugins: [] };
  }

  const outDir = resolve(config.root, config.blocks.outDir);
  mkdirSync(outDir, { recursive: true });

  await build(viteAssetConfig(config, outDir, discovered.entries, options.mode ?? 'production'));
  const manifest = writeAssetsManifest(config, outDir, discovered);
  console.log(`✓ WordPress assets built (${discovered.entries.length} entr${discovered.entries.length === 1 ? 'y' : 'ies'})`);
  return manifest;
}

export async function startWordPressAssetWatcher(config: LoadedViteWpConfig): Promise<WordPressAssetWatcher | null> {
  const discovered = discoverAssets(config);

  if (discovered.entries.length === 0) {
    return null;
  }

  const outDir = resolve(config.root, config.blocks.outDir);
  mkdirSync(outDir, { recursive: true });

  const watcher = await build({
    ...viteAssetConfig(config, outDir, discovered.entries, 'development'),
    build: {
      ...viteAssetConfig(config, outDir, discovered.entries, 'development').build,
      watch: {},
    },
  }) as {
    on: (event: 'event', callback: (event: { code: string; error?: { message?: string } }) => void) => void;
    close: () => Promise<void> | void;
  };

  await new Promise<void>((resolve, reject) => {
    let settled = false;

    watcher.on('event', (event) => {
      if (event.code === 'START') {
        console.log('Building WordPress block/plugin assets...');
      }

      if (event.code === 'END') {
        writeAssetsManifest(config, outDir, discovered);
        console.log(`✓ WordPress assets watching (${discovered.entries.length} entr${discovered.entries.length === 1 ? 'y' : 'ies'})`);

        if (!settled) {
          settled = true;
          resolve();
        }
      }

      if (event.code === 'ERROR') {
        console.error(`WordPress asset build failed: ${event.error?.message ?? 'unknown error'}`);

        if (!settled) {
          settled = true;
          reject(new Error(event.error?.message ?? 'WordPress asset build failed.'));
        }
      }
    });
  });

  return {
    stop: async () => {
      await watcher.close();
    },
  };
}

function discoverAssets(config: LoadedViteWpConfig): DiscoveredAssets {
  const blocks = discoverBlocks(config);
  const pluginEntries = discoverPluginEntries(config);
  return {
    blocks,
    pluginEntries,
    entries: [...blocks.flatMap((block) => block.entries), ...pluginEntries],
  };
}

function writeAssetsManifest(config: LoadedViteWpConfig, outDir: string, discovered: DiscoveredAssets) {
  const builtEntries = withBuiltFiles(outDir, discovered.entries);
  const manifest: AssetsManifest = {
    version: 1,
    blocks: discovered.blocks.map((block) => ({
      name: block.name,
      metadataFile: relative(config.root, block.metadataFile),
      directory: relative(config.root, block.directory),
      entries: block.entries.map((entry) => builtEntries.get(entry.id) ?? entry).map(relativeEntry(config.root)),
    })),
    plugins: discovered.pluginEntries.map((entry) => builtEntries.get(entry.id) ?? entry).map(relativeEntry(config.root)),
  };

  writeFileSync(join(outDir, 'vitewp-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

function withBuiltFiles(outDir: string, entries: AssetEntry[]) {
  const viteManifestFile = join(outDir, '.vite/manifest.json');
  const viteManifest = existsSync(viteManifestFile)
    ? JSON.parse(readFileSync(viteManifestFile, 'utf8')) as Record<string, { name?: string; file?: string; css?: string[]; src?: string }>
    : {};
  const byId = new Map<string, AssetEntry>();

  for (const entry of entries) {
    const chunk = Object.values(viteManifest).find((item) => item.name === entry.id || item.src === entry.source);
    byId.set(entry.id, {
      ...entry,
      file: chunk?.file,
      css: chunk?.css ?? [],
    });
  }

  return byId;
}

function discoverBlocks(config: LoadedViteWpConfig): DiscoveredBlock[] {
  const files = config.blocks.entries.flatMap((pattern) => findFiles(config.root, pattern));

  return files.map((metadataFile) => {
    const directory = dirname(metadataFile);
    const metadata = JSON.parse(readFileSync(metadataFile, 'utf8')) as Record<string, unknown>;
    const name = String(metadata.name ?? basename(directory));
    const entries = blockAssetFields.flatMap(([field, kind]) => {
      const values = normalizeAssetField(metadata[field]);
      return values
        .map((value) => resolveAssetReference(directory, value))
        .filter((source): source is string => Boolean(source))
        .map((source) => ({
          id: safeId(`${name}-${field}-${basename(source, extname(source))}`),
          source,
          kind,
          handle: safeId(`${name}-${field}`),
          dependencies: dependenciesForSource(source),
        }));
    });

    return { name, directory, metadataFile, metadata, entries };
  });
}

function discoverPluginEntries(config: LoadedViteWpConfig): AssetEntry[] {
  return config.plugins.entries
    .flatMap((pattern) => findFiles(config.root, pattern))
    .filter((source) => /\.(m?[jt]sx?|css)$/.test(source))
    .map((source) => ({
      id: safeId(`plugin-${relative(config.root, source)}`),
      source,
      kind: source.endsWith('.css') ? 'style' : 'script',
      handle: safeId(`vitewp-plugin-${basename(source, extname(source))}`),
      dependencies: dependenciesForSource(source),
    }));
}

function viteAssetConfig(
  config: LoadedViteWpConfig,
  outDir: string,
  entries: AssetEntry[],
  mode: 'development' | 'production',
): InlineConfig {
  return {
    root: config.root,
    mode,
    logLevel: 'warn',
    build: {
      emptyOutDir: true,
      manifest: true,
      outDir,
      sourcemap: mode === 'development',
      rollupOptions: {
        input: Object.fromEntries(entries.map((entry) => [entry.id, entry.source])),
        external: [/^@wordpress\//],
        output: {
          entryFileNames: 'scripts/[name].js',
          chunkFileNames: 'scripts/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
  };
}

function findFiles(root: string, pattern: string) {
  if (!pattern.includes('*')) {
    const file = resolve(root, pattern);
    return existsSync(file) ? [file] : [];
  }

  const [basePrefix, suffix] = pattern.split('**/');
  const base = resolve(root, basePrefix || '.');
  const expectedSuffix = suffix ?? basename(pattern);

  if (!existsSync(base)) {
    return [];
  }

  return walk(base).filter((file) => file.endsWith(expectedSuffix));
}

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const file = join(directory, entry);
    const stats = statSync(file);

    if (stats.isDirectory()) {
      return walk(file);
    }

    return stats.isFile() ? [file] : [];
  });
}

function normalizeAssetField(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return [];
}

function resolveAssetReference(directory: string, value: string) {
  if (!value.startsWith('file:')) return null;

  const file = resolve(directory, value.slice('file:'.length));
  return existsSync(file) ? file : null;
}

function dependenciesForSource(source: string) {
  if (!/\.[cm]?[jt]sx?$/.test(source)) return [];

  const code = readFileSync(source, 'utf8');
  const matches = code.matchAll(/from\s+['"](@wordpress\/[^'"]+)['"]|import\s+['"](@wordpress\/[^'"]+)['"]/g);
  const dependencies = new Set<string>();

  for (const match of matches) {
    const specifier = match[1] ?? match[2];
    if (specifier) {
      dependencies.add(wordPressDependencyHandle(specifier));
    }
  }

  return [...dependencies];
}

function wordPressDependencyHandle(specifier: string) {
  return specifier.replace('@wordpress/', 'wp-').replace(/\//g, '-');
}

function safeId(value: string) {
  return value.replace(/^@/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
}

function relativeEntry(root: string) {
  return (entry: AssetEntry): AssetEntry => ({
    ...entry,
    source: relative(root, entry.source),
  });
}
