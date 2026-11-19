// Cổng i18n (ADR-0023):
// 1. Mỗi khóa trong messages/<vùng>/vi.json phải có ở en.json (và ngược lại),
//    cùng bộ tham số {name}.
// 2. Mọi `m.<khóa>` trong src/ (kể cả test) phải có trong messages/. Dự án là
//    JS nên khóa sai chỉ văng TypeError lúc render; bước này bắt nó từ lint.
//    Không cho truy cập động `m[...]`: danh sách/nhãn động dùng map hàm message.
// 3. Ratchet số dòng còn chữ tiếng Việt viết cứng trong src/ (bỏ test, comment,
//    mã sinh). Mỗi vùng chỉ được giảm; giảm rồi thì chạy `--update` để khóa mức
//    mới. Hết lộ trình di trú, mọi vùng về 0.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const FRONTEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MESSAGES_DIR = path.join(FRONTEND_DIR, 'messages')
const SRC_DIR = path.join(FRONTEND_DIR, 'src')
const BASELINE_PATH = path.join(FRONTEND_DIR, 'scripts/i18n-baseline.json')
const VIETNAMESE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i
const SKIPPED = [/\.test\.jsx?$/, /\/tests?\//, /^src\/test\//, /^src\/shared\/config\/i18n\/paraglide\//]

const errors = []

function readMessages(file) {
  const { $schema: _schema, ...messages } = JSON.parse(readFileSync(file, 'utf8'))
  return messages
}

function placeholders(value) {
  // Biến thể số nhiều lặp lại tham số ở mỗi nhánh; so tập tên, không so số lần.
  return [...new Set([...JSON.stringify(value).matchAll(/\{(\w+)\}/g)].map((match) => match[1]))].sort().join(',')
}

const knownKeys = new Set()
for (const area of readdirSync(MESSAGES_DIR)) {
  const vi = readMessages(path.join(MESSAGES_DIR, area, 'vi.json'))
  Object.keys(vi).forEach((key) => knownKeys.add(key))
  const en = readMessages(path.join(MESSAGES_DIR, area, 'en.json'))
  for (const key of Object.keys(vi)) {
    if (!(key in en)) errors.push(`messages/${area}/en.json thiếu khóa ${key}`)
    else if (placeholders(vi[key]) !== placeholders(en[key])) {
      errors.push(`messages/${area}: tham số của ${key} khác nhau giữa vi và en`)
    }
  }
  for (const key of Object.keys(en)) {
    if (!(key in vi)) errors.push(`messages/${area}/vi.json thiếu khóa ${key}`)
  }
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    return /\.jsx?$/.test(entry.name) ? [full] : []
  })
}

// Bỏ comment trước khi đếm; chuỗi chứa "//" (URL) chỉ làm đếm thiếu, không đếm thừa.
function countHardcodedLines(source) {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ''))
  return withoutBlocks
    .split('\n')
    .map((line) => line.replace(/(^|[^:'"`])\/\/.*$/, '$1').replace(/\{\/\*.*?\*\/\}/g, ''))
    .filter((line) => VIETNAMESE.test(line))
    .length
}

// Vùng = lớp + cổng (vd. features/employer), trùng thứ tự di trú trong ADR.
function areaOf(relative) {
  const [, layer, portal] = relative.split('/')
  if (!portal) return 'src'
  return ['pages', 'widgets', 'features'].includes(layer) && !portal.includes('.') ? `${layer}/${portal}` : layer
}

// Chỉ xét tệp import `m` từ @/shared/config/i18n để không nhầm biến `m` khác.
const IMPORTS_MESSAGES = /import\s*\{[^}]*\bm\b[^}]*\}\s*from\s*['"]@\/shared\/config\/i18n['"]/
function checkMessageUsages(relative, source) {
  if (!IMPORTS_MESSAGES.test(source)) return
  for (const [, key] of source.matchAll(/\bm\.(\w+)/g)) {
    if (!knownKeys.has(key)) errors.push(`${relative}: m.${key} không có trong messages/`)
  }
  if (/\bm\[/.test(source)) errors.push(`${relative}: không truy cập động m[...]; dùng map hàm message`)
}

const counts = {}
for (const file of walk(SRC_DIR)) {
  const relative = path.relative(FRONTEND_DIR, file).split(path.sep).join('/')
  if (relative.startsWith('src/shared/config/i18n/paraglide/')) continue
  const source = readFileSync(file, 'utf8')
  checkMessageUsages(relative, source)
  if (SKIPPED.some((pattern) => pattern.test(relative))) continue
  const area = areaOf(relative)
  counts[area] = (counts[area] ?? 0) + countHardcodedLines(source)
}

const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)))
let baseline = null
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
} catch {
  // Chưa có baseline: --update tạo mới từ số đo hiện tại.
}

for (const [area, count] of Object.entries(sorted)) {
  const allowed = baseline?.[area] ?? 0
  if (baseline && count > allowed) {
    errors.push(`${area}: ${count} dòng tiếng Việt viết cứng (trần ${allowed}); đưa chuỗi mới vào messages/ và dùng m.key()`)
  } else if (count < allowed && !process.argv.includes('--update')) {
    console.log(`${area}: giảm còn ${count} (trần ${allowed}); chạy npm run check:i18n -- --update để khóa mức mới`)
  }
}

// --update chỉ hạ trần (ratchet), không bao giờ nâng.
if (process.argv.includes('--update') && !errors.length) {
  const next = Object.fromEntries(
    Object.entries(sorted).map(([area, count]) => [area, baseline ? Math.min(count, baseline[area] ?? 0) : count]),
  )
  writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`)
  console.log(`Đã cập nhật ${path.relative(FRONTEND_DIR, BASELINE_PATH)}`)
} else if (!baseline) {
  errors.push(`Thiếu ${path.relative(FRONTEND_DIR, BASELINE_PATH)}; chạy npm run check:i18n -- --update`)
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
const total = Object.values(sorted).reduce((sum, count) => sum + count, 0)
console.log(`i18n: khóa vi/en khớp; còn ${total} dòng tiếng Việt viết cứng trong src/`)
