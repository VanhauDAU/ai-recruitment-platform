import { gzipSync } from 'node:zlib'
import { readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const DIST_DIR = path.resolve('dist')
const INITIAL_JS_GZIP_BUDGET = 320 * 1024
const INITIAL_CSS_GZIP_BUDGET = 30 * 1024

function getAssetPaths(indexHtml) {
  const matches = indexHtml.matchAll(
    /<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"[^>]*>/g,
  )

  return [...matches]
    .map((match) => match[1])
    .filter((assetPath) => assetPath.startsWith('/assets/'))
    .map((assetPath) => assetPath.slice(1))
}

async function readAsset(assetPath) {
  const fullPath = path.join(DIST_DIR, assetPath)
  const contents = await readFile(fullPath)
  const fileStats = await stat(fullPath)

  return {
    path: assetPath,
    bytes: fileStats.size,
    gzipBytes: gzipSync(contents).length,
  }
}

function totalGzipBytes(assets) {
  return assets.reduce((total, asset) => total + asset.gzipBytes, 0)
}

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`
}

const indexHtml = await readFile(path.join(DIST_DIR, 'index.html'), 'utf8')
const assets = await Promise.all(getAssetPaths(indexHtml).map(readAsset))
const initialJavaScript = assets.filter((asset) => asset.path.endsWith('.js'))
const initialStylesheets = assets.filter((asset) => asset.path.endsWith('.css'))
const initialJavaScriptGzipBytes = totalGzipBytes(initialJavaScript)
const initialStylesheetsGzipBytes = totalGzipBytes(initialStylesheets)

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
}

await writeFile(path.join(DIST_DIR, 'bundle-stats.json'), `${JSON.stringify(report, null, 2)}\n`)

console.log(`Initial JavaScript: ${formatKiB(initialJavaScriptGzipBytes)} / ${formatKiB(INITIAL_JS_GZIP_BUDGET)} gzip`)
console.log(`Initial CSS: ${formatKiB(initialStylesheetsGzipBytes)} / ${formatKiB(INITIAL_CSS_GZIP_BUDGET)} gzip`)
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
