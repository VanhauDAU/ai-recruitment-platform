import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_DIR = path.resolve(SCRIPT_DIR, '..')
const FIXTURE_DIR = path.join(FRONTEND_DIR, 'tests/architecture/fixtures')
const DEPCRUISE_CLI = path.join(
  FRONTEND_DIR,
  'node_modules',
  'dependency-cruiser',
  'bin',
  'dependency-cruise.mjs',
)

const result = spawnSync(
  process.execPath,
  [
    DEPCRUISE_CLI,
    'src',
    '--config',
    path.join(FRONTEND_DIR, '.dependency-cruiser.cjs'),
    '--output-type',
    'json',
  ],
  {
    cwd: FIXTURE_DIR,
    encoding: 'utf8',
  },
)

if (result.error) {
  throw result.error
}

if (result.status !== 0) {
  throw new Error(
    `Architecture fixture cruise failed:\n${result.stderr || result.stdout}`,
  )
}

const cruiseResult = JSON.parse(result.stdout)
const errorRuleNames = new Set(
  cruiseResult.summary.violations
    .filter((violation) => violation.rule.severity === 'error')
    .map((violation) => violation.rule.name),
)
const expectedRuleNames = new Set([
  'no-circular',
  'no-cross-entity-import',
  'no-cross-page-portal-main',
  'no-cross-feature-import',
  'no-cross-portal-slice',
])
const missingRuleNames = [...expectedRuleNames]
  .filter((ruleName) => !errorRuleNames.has(ruleName))
const unexpectedRuleNames = [...errorRuleNames]
  .filter((ruleName) => !expectedRuleNames.has(ruleName))

if (missingRuleNames.length > 0 || unexpectedRuleNames.length > 0) {
  throw new Error([
    'Architecture rule fixture returned an unexpected rule set.',
    `Missing: ${missingRuleNames.join(', ') || 'none'}.`,
    `Unexpected: ${unexpectedRuleNames.join(', ') || 'none'}.`,
  ].join(' '))
}

// features: <cổng|common>/<module>/<slice>; widgets: <cổng|common>/<slice>;
// entities: <domain>/<entity>. Mỗi slice có index.js. Thư mục nhóm chỉ chứa thư
// mục con (không file, không index.js); tên cổng phải là một portal của pages
// hoặc common để no-cross-portal-slice luôn khớp.
const SRC_DIR = path.join(FRONTEND_DIR, 'src')
const listEntries = (dir) => readdirSync(dir, { withFileTypes: true })
const portalGroups = new Set([
  'common',
  ...listEntries(path.join(SRC_DIR, 'pages'))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name),
])
const structureErrors = []

const checkGroup = (groupPath, depth) => {
  for (const entry of listEntries(path.join(SRC_DIR, groupPath))) {
    const entryPath = `${groupPath}/${entry.name}`
    if (!entry.isDirectory()) {
      structureErrors.push(`${entryPath}: thư mục nhóm không được chứa file`)
    } else if (depth > 1) {
      checkGroup(entryPath, depth - 1)
    } else if (!existsSync(path.join(SRC_DIR, entryPath, 'index.js'))) {
      structureErrors.push(`${entryPath}: slice thiếu public API index.js`)
    }
  }
}

for (const [layer, depth, byPortal] of [['features', 2, true], ['widgets', 1, true], ['entities', 1, false]]) {
  for (const group of listEntries(path.join(SRC_DIR, layer))) {
    if (!group.isDirectory() || (byPortal && !portalGroups.has(group.name))) {
      structureErrors.push(`${layer}/${group.name}: chỉ cho phép thư mục ${byPortal ? [...portalGroups].join(', ') : 'nhóm domain'}`)
    } else {
      checkGroup(`${layer}/${group.name}`, depth)
    }
  }
}

if (structureErrors.length > 0) {
  throw new Error(`Slice group structure invalid:\n${structureErrors.join('\n')}`)
}

// vite.config.js khai báo index.js của slice không có side effect để bundler bỏ
// qua barrel. Một lệnh chạy lúc import (gọi hàm, gán, import trần) sẽ bị bỏ
// mất ở bản build, nên chặn ngay tại đây.
const SIDE_EFFECT_LINE = /^(import\s+['"]|(if|for|while|try|switch)\b|[\w$.]+\s*\(|[\w$]+(\.[\w$]+)+\s*=[^=])/
const impureBarrels = []
const walkBarrels = (dir) => {
  for (const entry of listEntries(dir)) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) walkBarrels(entryPath)
    else if (entry.name === 'index.js') {
      readFileSync(entryPath, 'utf8').split('\n').forEach((line, index) => {
        if (SIDE_EFFECT_LINE.test(line)) {
          impureBarrels.push(`${path.relative(SRC_DIR, entryPath)}:${index + 1}: ${line.trim()}`)
        }
      })
    }
  }
}
for (const layer of ['features', 'widgets', 'entities']) walkBarrels(path.join(SRC_DIR, layer))

if (impureBarrels.length > 0) {
  throw new Error(`Barrel index.js chỉ được export, không chạy lệnh lúc import:\n${impureBarrels.join('\n')}`)
}

// Mọi HTTP đi qua client chung ở shared/api (interceptor auth, refresh, lỗi).
// dependency-cruiser chỉ dựng đồ thị trong src/ nên không thấy import 'axios'.
const AXIOS_USAGE = /axios\.create|from\s+['"]axios['"]/
const SHARED_API_DIR = path.join(SRC_DIR, 'shared', 'api')
const axiosViolations = []
const walkSources = (dir) => {
  for (const entry of listEntries(dir)) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entryPath !== SHARED_API_DIR) walkSources(entryPath)
    } else if (/\.jsx?$/.test(entry.name)) {
      readFileSync(entryPath, 'utf8').split('\n').forEach((line, index) => {
        if (AXIOS_USAGE.test(line)) {
          axiosViolations.push(`${path.relative(SRC_DIR, entryPath)}:${index + 1}: ${line.trim()}`)
        }
      })
    }
  }
}
walkSources(SRC_DIR)

if (axiosViolations.length > 0) {
  throw new Error(`axios chỉ được dùng trong src/shared/api:\n${axiosViolations.join('\n')}`)
}

console.log(
  `Architecture rule fixtures: ${[...expectedRuleNames].join(', ')} detected`,
)
