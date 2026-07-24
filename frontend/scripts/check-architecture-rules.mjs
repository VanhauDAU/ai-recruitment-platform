import { spawnSync } from 'node:child_process'
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
  'no-cross-entity-import-account',
  'no-cross-page-portal-main',
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

console.log(
  `Architecture rule fixtures: ${[...expectedRuleNames].join(', ')} detected`,
)
