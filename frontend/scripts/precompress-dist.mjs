// Nén sẵn dist/ ở mức gzip cao nhất để nginx (`gzip_static on`) gửi thẳng file .gz
// thay vì nén lại từng request ở mức thấp. Chỉ chạy trong image production
// (frontend/Dockerfile); dev và CI không cần.
import { constants, gzipSync } from 'node:zlib'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DIST_DIR = path.resolve('dist')
const COMPRESSIBLE = /\.(js|mjs|css|html|svg|json|xml|txt|webmanifest)$/
const MIN_BYTES = 1024

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(fullPath)
    else if (COMPRESSIBLE.test(entry.name)) yield fullPath
  }
}

let count = 0
let before = 0
let after = 0
for await (const file of walk(DIST_DIR)) {
  const contents = await readFile(file)
  if (contents.length < MIN_BYTES) continue
  const compressed = gzipSync(contents, { level: constants.Z_BEST_COMPRESSION })
  if (compressed.length >= contents.length) continue
  await writeFile(`${file}.gz`, compressed)
  count += 1
  before += contents.length
  after += compressed.length
}

const kib = (bytes) => `${(bytes / 1024).toFixed(0)} KiB`
console.log(`Precompressed ${count} files: ${kib(before)} -> ${kib(after)} gzip`)
