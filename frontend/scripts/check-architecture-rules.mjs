import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
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

console.log(
  `Architecture rule fixtures: ${[...expectedRuleNames].join(', ')} detected`,
)
