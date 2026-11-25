#!/usr/bin/env node
// Chia file unit test thành N shard có tổng thời gian gần bằng nhau.
//
//   node scripts/plan-vitest-shards.mjs --shard 2 --total 7        # in danh sách file của shard 2
//   node scripts/plan-vitest-shards.mjs --total 7 --summary        # in tổng giây từng shard
//   node scripts/plan-vitest-shards.mjs --from-junit vitest-results.xml   # ghi lại bảng thời lượng
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
import { parseJunit } from '../../scripts/ci/check_test_budgets.mjs'

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

function writeFromJunit(reports) {
  const perFile = {}
  for (const report of reports) {
    for (const item of parseJunit(readFileSync(report, 'utf8'))) {
      if (item.group) perFile[item.group] = (perFile[item.group] ?? 0) + item.seconds
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
  const junit = argument('--from-junit')
  if (junit) {
    writeFromJunit(process.argv.slice(process.argv.indexOf('--from-junit') + 1).filter((arg) => !arg.startsWith('--')))
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
