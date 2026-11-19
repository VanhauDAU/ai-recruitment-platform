// Ghi tóm tắt một job E2E vào GITHUB_STEP_SUMMARY và cảnh báo test flaky.
// Viết bằng Node vì job E2E chạy trong image Playwright (không có Python).
// Dùng: node scripts/report-e2e-summary.mjs <junit.xml> <playwright.log>
import { appendFileSync, existsSync, readFileSync } from 'node:fs'

const [junitPath = 'test-results/e2e-results.xml', logPath = 'e2e.log'] = process.argv.slice(2)
const { GITHUB_STEP_SUMMARY, JOB_STATUS = 'unknown', PROJECT = 'unknown', STARTED_AT } = process.env

const ANSI_COLOR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

const metrics = { tests: 'n/a', failures: 'n/a', errors: 'n/a', skipped: 'n/a', time: 'n/a' }
if (existsSync(junitPath)) {
  const root = readFileSync(junitPath, 'utf8').match(/<testsuites\b[^>]*>/)?.[0] ?? ''
  for (const key of Object.keys(metrics)) {
    metrics[key] = root.match(new RegExp(`\\b${key}="([^"]*)"`))?.[1] ?? 'n/a'
  }
}

// Playwright's line reporter lists "N flaky" followed by one indented
// "[project] › file:line › title" entry per test that only passed on retry.
const flaky = []
if (existsSync(logPath)) {
  const lines = readFileSync(logPath, 'utf8').replace(ANSI_COLOR, '').split('\n')
  lines.forEach((line, index) => {
    if (!/^\s+\d+ flaky\s*$/.test(line)) return
    for (const entry of lines.slice(index + 1)) {
      if (!/^\s+\[/.test(entry)) break
      flaky.push(entry.trim())
    }
  })
}

const startedAt = Number(STARTED_AT) || Math.floor(Date.now() / 1000)
const elapsed = Math.max(0, Math.floor(Date.now() / 1000) - startedAt)
const rows = [
  `## Frontend E2E smoke — ${PROJECT}`,
  '',
  '| Metric | Value |',
  '| --- | --- |',
  `| Result | ${JOB_STATUS} |`,
  `| Tests | ${metrics.tests} |`,
  `| Failures / errors / skipped | ${metrics.failures} / ${metrics.errors} / ${metrics.skipped} |`,
  `| Playwright duration | ${metrics.time}s |`,
  `| Measured checks elapsed | ${elapsed}s |`,
  `| Flaky (passed on retry) | ${flaky.length} |`,
  ...flaky.map((entry) => `\n- \`${entry}\``),
  '',
]
if (GITHUB_STEP_SUMMARY) appendFileSync(GITHUB_STEP_SUMMARY, `${rows.join('\n')}\n`)
else console.log(rows.join('\n'))
// A test that only passed on its retry is not a clean pass.
for (const entry of flaky) console.log(`::warning title=Flaky E2E test (passed on retry)::${entry}`)
