#!/usr/bin/env node
// Chia file unit test thành N shard có tổng thời gian gần bằng nhau.
//
//   node scripts/plan-vitest-shards.mjs --shard 2 --total 7        # in danh sách file của shard 2
//   node scripts/plan-vitest-shards.mjs --total 7 --summary        # in tổng giây từng shard
//   node scripts/plan-vitest-shards.mjs --from-blobs .vitest-reports    # ghi lại bảng thời lượng
//
// `vitest --shard` chia theo số file nên shard chậm nhất từng gấp đôi shard nhanh
// nhất (128s so với 272s). Script này đọc thời lượng từng file ở
// tests/vitest-durations.json (đo trên CI, 1 worker, có coverage) rồi xếp tham lam:
// file lâu nhất trước, mỗi file vào shard đang nhẹ nhất. File chưa có số đo tính
// bằng trung vị. Kết quả tất định với cùng danh sách file và bảng thời lượng.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const FRONTEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DURATIONS_PATH = path.join(FRONTEND_DIR, 'tests/vitest-durations.json')
const TEST_FILE = /\.test\.jsx?$/

function listTestFiles(dir = path.join(FRONTEND_DIR, 'src')) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'paraglide' ? [] : listTestFiles(full)
    return TEST_FILE.test(entry.name) ? [path.relative(FRONTEND_DIR, full).split(path.sep).join('/')] : []
  })
}

function readDurations() {
  try {
    return JSON.parse(readFileSync(DURATIONS_PATH, 'utf8'))
  } catch {
    return {}
  }
}

export function planShards(files, durations, total) {
  const known = files.map((file) => durations[file]).filter((value) => value > 0).sort((a, b) => a - b)
  const fallback = known.length ? known[Math.floor(known.length / 2)] : 1
  const weighted = files
    .map((file) => ({ file, seconds: durations[file] > 0 ? durations[file] : fallback }))
    .sort((a, b) => b.seconds - a.seconds || a.file.localeCompare(b.file))
  const shards = Array.from({ length: total }, () => ({ seconds: 0, files: [] }))
  for (const item of weighted) {
    const lightest = shards.reduce((best, shard) => (shard.seconds < best.seconds ? shard : best))
    lightest.files.push(item.file)
    lightest.seconds += item.seconds
  }
  return shards
}

// Blob report của vitest được tuần tự hóa bằng flatted: mảng phẳng, mọi chuỗi trong
// object/mảng là chỉ số trỏ tới phần tử khác. Đọc thẳng blob (thay vì JUnit của bước
// gộp) để vẫn có số đo khi bước gộp coverage đỏ.
function parseFlatted(text) {
  const input = JSON.parse(text)
  const known = new Map()
  const revive = (index) => {
    if (known.has(index)) return known.get(index)
    const value = input[index]
    if (value === null || typeof value !== 'object') {
      known.set(index, value)
      return value
    }
    const out = Array.isArray(value) ? [] : {}
    known.set(index, out)
    for (const [key, item] of Object.entries(value)) out[key] = typeof item === 'string' ? revive(Number(item)) : item
    return out
  }
  return revive(0)
}

// Thời lượng một file như shard thấy: thu thập + setup + môi trường + chạy test.
function fileSeconds(file) {
  const ms = ['collectDuration', 'setupDuration', 'prepareDuration', 'environmentLoad']
    .reduce((total, key) => total + (file[key] || 0), file.result?.duration || 0)
  return Number((ms / 1000).toFixed(2))
}

function writeFromBlobs(dir) {
  const perFile = {}
  for (const name of readdirSync(dir).filter((entry) => entry.endsWith('.json'))) {
    const root = parseFlatted(readFileSync(path.join(dir, name), 'utf8'))
    const files = root.find((item) => Array.isArray(item) && item[0]?.filepath) || []
    for (const file of files) {
      const marker = `${path.sep}frontend${path.sep}`
      const start = file.filepath.lastIndexOf(marker)
      const relative = start === -1 ? path.relative(FRONTEND_DIR, file.filepath) : file.filepath.slice(start + marker.length)
      perFile[relative.split(path.sep).join('/')] = fileSeconds(file)
    }
  }
  const sorted = Object.fromEntries(
    Object.entries(perFile).sort(([a], [b]) => a.localeCompare(b)).map(([file, seconds]) => [file, Number(seconds.toFixed(2))]),
  )
  writeFileSync(DURATIONS_PATH, `${JSON.stringify(sorted, null, 2)}\n`)
  console.log(`${Object.keys(sorted).length} file -> ${path.relative(FRONTEND_DIR, DURATIONS_PATH)}`)
}

function argument(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const blobs = argument('--from-blobs')
  if (blobs) {
    writeFromBlobs(blobs)
  } else {
    const total = Number(argument('--total'))
    if (!Number.isInteger(total) || total < 1) throw new Error('--total <số shard> là bắt buộc')
    const shards = planShards(listTestFiles(), readDurations(), total)
    if (process.argv.includes('--summary')) {
      shards.forEach((shard, index) => console.log(`shard ${index + 1}: ${shard.files.length} file, ~${shard.seconds.toFixed(0)}s`))
    } else {
      const shard = Number(argument('--shard'))
      if (!Number.isInteger(shard) || shard < 1 || shard > total) throw new Error(`--shard phải từ 1 đến ${total}`)
      console.log(shards[shard - 1].files.join('\n'))
    }
  }
}
