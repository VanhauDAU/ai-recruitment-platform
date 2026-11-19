#!/usr/bin/env node
// Kiểm ngân sách thời gian test từ báo cáo JUnit (chuẩn: docs/05-huong-dan/tieu-chuan-kiem-thu.md).
//
//   node scripts/check_test_budgets.mjs --suite <backend|frontend-unit|e2e> <junit.xml>...
//
// - Vượt ngưỡng mềm: cảnh báo trên PR (::warning) — nên sửa, chưa chặn merge.
// - Vượt ngưỡng cứng: lỗi (::error), exit 1 — phải sửa hoặc tách test.
// Không có whitelist: một test chậm hợp lý vẫn phải nằm dưới ngưỡng cứng.
// Viết bằng Node (không phụ thuộc gói ngoài) để chạy được ở runner backend,
// runner frontend và trong image Playwright.
import { appendFileSync, existsSync, readFileSync } from 'node:fs'

// Giây. Đo trên runner GitHub 4 vCPU: backend chỉ tính phần `call` (pytest
// -o junit_duration_report=call), unit frontend chạy 1 worker kèm coverage.
export const BUDGETS = {
  backend: { test: { soft: 2, hard: 15 } },
  'frontend-unit': { test: { soft: 3, hard: 10 }, file: { soft: 10, hard: 30 } },
  // Timeout của Playwright (30s, test.slow() ×3) vẫn là chốt chặn chính.
  e2e: { test: { soft: 15, hard: 90 } },
}

const MAX_ANNOTATIONS = 20
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

const decode = (value) => value.replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => ENTITIES[name])

function attributes(tag) {
  const result = {}
  for (const [, name, value] of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) result[name] = decode(value)
  return result
}

export function parseJunit(xml) {
  const cases = []
  for (const match of xml.matchAll(/<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const attrs = attributes(match[1])
    const body = match[3] ?? ''
    if (/<skipped\b/.test(body)) continue
    cases.push({
      name: attrs.name ?? '(không tên)',
      group: attrs.classname || attrs.file || '',
      seconds: Number.parseFloat(attrs.time) || 0,
    })
  }
  return cases
}

const format = (seconds) => `${seconds.toFixed(2)}s`
// Ô bảng markdown: ký tự | trong tên test sẽ phá cột.
const cell = (label) => `\`${label.slice(0, 160).replace(/\|/g, '\\|')}\``

export function evaluate(cases, budget) {
  const findings = []
  const check = (kind, label, seconds, limits) => {
    if (seconds > limits.hard) findings.push({ level: 'error', kind, label, seconds, limit: limits.hard })
    else if (seconds > limits.soft) findings.push({ level: 'warning', kind, label, seconds, limit: limits.soft })
  }
  for (const item of cases) check('test', `${item.group} › ${item.name}`, item.seconds, budget.test)
  if (budget.file) {
    const files = new Map()
    for (const item of cases) files.set(item.group, (files.get(item.group) ?? 0) + item.seconds)
    for (const [group, seconds] of files) check('file', group, seconds, budget.file)
  }
  return findings.sort((a, b) => b.seconds - a.seconds)
}

function main(argv) {
  const suiteIndex = argv.indexOf('--suite')
  const suite = suiteIndex >= 0 ? argv[suiteIndex + 1] : undefined
  const files = argv.filter((_, index) => index !== suiteIndex && index !== suiteIndex + 1)
  const budget = BUDGETS[suite]
  if (!budget || files.length === 0) {
    console.error(`Dùng: check_test_budgets.mjs --suite <${Object.keys(BUDGETS).join('|')}> <junit.xml>...`)
    return 2
  }
  const missing = files.filter((file) => !existsSync(file))
  if (missing.length) {
    console.error(`Không thấy báo cáo JUnit: ${missing.join(', ')}`)
    return 2
  }

  const cases = files.flatMap((file) => parseJunit(readFileSync(file, 'utf8')))
  if (cases.length === 0) {
    console.error('Báo cáo JUnit không có test nào — sai đường dẫn hoặc reporter?')
    return 2
  }
  const findings = evaluate(cases, budget)
  const errors = findings.filter((item) => item.level === 'error')
  const warnings = findings.filter((item) => item.level === 'warning')
  const slowest = [...cases].sort((a, b) => b.seconds - a.seconds).slice(0, 10)
  const total = cases.reduce((sum, item) => sum + item.seconds, 0)

  const limits = Object.entries(budget)
    .map(([kind, { soft, hard }]) => `${kind === 'test' ? 'mỗi test' : 'mỗi file'} ${soft}s / ${hard}s`)
    .join('; ')
  const lines = [
    `## Ngân sách thời gian test — ${suite}`,
    '',
    `${cases.length} test, tổng ${format(total)}. Ngưỡng mềm / cứng: ${limits}.`,
    `Vượt cứng: **${errors.length}** · vượt mềm: **${warnings.length}**.`,
    '',
    '| Chậm nhất | Thời gian |',
    '| --- | --- |',
    ...slowest.map((item) => `| ${cell(`${item.group} › ${item.name}`)} | ${format(item.seconds)} |`),
    '',
  ]
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`)
  console.log(lines.join('\n'))

  for (const item of [...errors, ...warnings].slice(0, MAX_ANNOTATIONS)) {
    const title = `${item.level === 'error' ? 'Vượt ngưỡng cứng' : 'Vượt ngưỡng mềm'} (${item.kind} > ${item.limit}s)`
    console.log(`::${item.level} title=${title}::${item.label} mất ${format(item.seconds)}`)
  }
  return errors.length ? 1 : 0
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)))
