import { gzipSync } from 'node:zlib'
import { readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const DIST_DIR = path.resolve('dist')
const MANIFEST_PATH = path.join(DIST_DIR, '.vite/manifest.json')
const INITIAL_JS_GZIP_BUDGET = 320 * 1024
// Shared account-setting styles now ship with the initial shell. Keep a narrow
// allowance for those accessible responsive styles while retaining a real cap.
const INITIAL_CSS_GZIP_BUDGET = 38 * 1024
const assetCache = new Map()

function getAssetPaths(indexHtml) {
  const matches = indexHtml.matchAll(
    /<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"[^>]*>/g,
  )
  const assetPaths = [...matches]
    .map((match) => match[1])
    .filter((assetPath) => assetPath.startsWith('/assets/'))
    .map((assetPath) => assetPath.slice(1))

  return [...new Set(assetPaths)]
}

async function readAsset(assetPath) {
  const normalizedPath = assetPath.replace(/^\/+/, '')

  if (!assetCache.has(normalizedPath)) {
    assetCache.set(normalizedPath, (async () => {
      const fullPath = path.join(DIST_DIR, normalizedPath)
      const contents = await readFile(fullPath)
      const fileStats = await stat(fullPath)

      return {
        path: normalizedPath,
        bytes: fileStats.size,
        gzipBytes: gzipSync(contents).length,
      }
    })())
  }

  return assetCache.get(normalizedPath)
}

function totalGzipBytes(assets) {
  return assets.reduce((total, asset) => total + asset.gzipBytes, 0)
}

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`
}

function getManifestEntry(manifest, manifestKey) {
  const entry = manifest[manifestKey]

  if (!entry) {
    throw new Error(`Vite manifest references missing entry: ${manifestKey}`)
  }

  return entry
}

function manifestSource(manifestKey, entry) {
  return entry.src ?? manifestKey
}

function collectStaticChunkKeys(manifest, manifestKey, collected = new Set()) {
  if (collected.has(manifestKey)) {
    return collected
  }

  const entry = getManifestEntry(manifest, manifestKey)
  collected.add(manifestKey)

  for (const importedKey of entry.imports ?? []) {
    collectStaticChunkKeys(manifest, importedKey, collected)
  }

  return collected
}

async function describeChunk(manifest, [manifestKey, entry]) {
  const chunkAsset = await readAsset(entry.file)
  const stylesheets = await Promise.all((entry.css ?? []).map(readAsset))

  return {
    source: manifestSource(manifestKey, entry),
    name: entry.name ?? null,
    path: chunkAsset.path,
    bytes: chunkAsset.bytes,
    gzipBytes: chunkAsset.gzipBytes,
    isEntry: entry.isEntry === true,
    isDynamicEntry: entry.isDynamicEntry === true,
    imports: (entry.imports ?? [])
      .map((importedKey) => getManifestEntry(manifest, importedKey).file),
    dynamicImports: (entry.dynamicImports ?? [])
      .map((importedKey) => getManifestEntry(manifest, importedKey).file),
    stylesheets,
  }
}

async function describeDynamicRoute(
  manifest,
  [manifestKey, entry],
  initialAssetPaths,
) {
  const chunkKeys = collectStaticChunkKeys(manifest, manifestKey)
  const routeAssetPaths = new Set()
  const referencedAssets = new Set()

  for (const chunkKey of chunkKeys) {
    const chunk = getManifestEntry(manifest, chunkKey)
    routeAssetPaths.add(chunk.file)

    for (const stylesheetPath of chunk.css ?? []) {
      routeAssetPaths.add(stylesheetPath)
    }

    for (const referencedAssetPath of chunk.assets ?? []) {
      referencedAssets.add(referencedAssetPath)
    }
  }

  const incrementalAssetPaths = [...routeAssetPaths]
    .filter((assetPath) => !initialAssetPaths.has(assetPath))
    .sort()
  const incrementalAssets = await Promise.all(
    incrementalAssetPaths.map(readAsset),
  )
  const javascriptAssets = incrementalAssets
    .filter((asset) => asset.path.endsWith('.js'))
  const stylesheetAssets = incrementalAssets
    .filter((asset) => asset.path.endsWith('.css'))
  const source = manifestSource(manifestKey, entry)

  return {
    source,
    portal: source.match(/^src\/pages\/([^/]+)\//)?.[1] ?? 'shared',
    entryPath: entry.file,
    javascriptGzipBytes: totalGzipBytes(javascriptAssets),
    stylesheetsGzipBytes: totalGzipBytes(stylesheetAssets),
    totalGzipBytes: totalGzipBytes(incrementalAssets),
    incrementalAssets,
    referencedAssets: [...referencedAssets].sort(),
  }
}

const indexHtml = await readFile(path.join(DIST_DIR, 'index.html'), 'utf8')
const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'))
const assets = await Promise.all(getAssetPaths(indexHtml).map(readAsset))
const initialJavaScript = assets.filter((asset) => asset.path.endsWith('.js'))
const initialStylesheets = assets.filter((asset) => asset.path.endsWith('.css'))
const initialJavaScriptGzipBytes = totalGzipBytes(initialJavaScript)
const initialStylesheetsGzipBytes = totalGzipBytes(initialStylesheets)
const manifestChunks = Object.entries(manifest)
  .filter(([, entry]) => entry.file.endsWith('.js'))
  .sort(([, left], [, right]) => left.file.localeCompare(right.file))
const chunks = await Promise.all(
  manifestChunks.map((manifestEntry) => describeChunk(manifest, manifestEntry)),
)
const initialAssetPaths = new Set(assets.map((asset) => asset.path))
const dynamicRouteEntries = manifestChunks
  .filter(([manifestKey, entry]) => (
    entry.isDynamicEntry === true
    && manifestSource(manifestKey, entry).startsWith('src/pages/')
  ))
  .sort(([leftKey, left], [rightKey, right]) => (
    manifestSource(leftKey, left).localeCompare(manifestSource(rightKey, right))
  ))
const dynamicRoutes = await Promise.all(
  dynamicRouteEntries.map((manifestEntry) => (
    describeDynamicRoute(manifest, manifestEntry, initialAssetPaths)
  )),
)

const report = {
  generatedAt: new Date().toISOString(),
  budgets: {
    initialJavaScriptGzipBytes: INITIAL_JS_GZIP_BUDGET,
    initialStylesheetsGzipBytes: INITIAL_CSS_GZIP_BUDGET,
  },
  initial: {
    javascriptGzipBytes: initialJavaScriptGzipBytes,
    stylesheetsGzipBytes: initialStylesheetsGzipBytes,
    assets,
  },
  chunks,
  dynamicRoutes,
}

await writeFile(path.join(DIST_DIR, 'bundle-stats.json'), `${JSON.stringify(report, null, 2)}\n`)

console.log(`Initial JavaScript: ${formatKiB(initialJavaScriptGzipBytes)} / ${formatKiB(INITIAL_JS_GZIP_BUDGET)} gzip`)
console.log(`Initial CSS: ${formatKiB(initialStylesheetsGzipBytes)} / ${formatKiB(INITIAL_CSS_GZIP_BUDGET)} gzip`)
console.log(`Measured chunks: ${chunks.length}; dynamic routes: ${dynamicRoutes.length}`)
console.log('Bundle report: dist/bundle-stats.json')

const overBudget = [
  ['Initial JavaScript', initialJavaScriptGzipBytes, INITIAL_JS_GZIP_BUDGET],
  ['Initial CSS', initialStylesheetsGzipBytes, INITIAL_CSS_GZIP_BUDGET],
].filter(([, actual, budget]) => actual > budget)

if (overBudget.length > 0) {
  for (const [name, actual, budget] of overBudget) {
    console.error(`${name} exceeds its gzip budget by ${formatKiB(actual - budget)}.`)
  }
  process.exitCode = 1
}
