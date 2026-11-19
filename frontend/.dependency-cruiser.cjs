const { readdirSync } = require('node:fs')
const { join } = require('node:path')

// Đọc slice từ filesystem để slice mới tự động được áp rule, không cần nhớ
// cập nhật danh sách hardcode (trước đây thiếu 7 feature và 2 widget).
const listSlices = (layer) =>
  readdirSync(join(__dirname, 'src', layer), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const pagePortals = listSlices('pages')

module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'src modules must not participate in circular dependencies',
      severity: 'error',
      from: { path: '^src/' },
      to: { circular: true },
    },
    {
      name: 'shared-only-depends-on-shared',
      comment: 'shared must not depend on any higher architectural layer',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/(app|pages|widgets|features|entities)/' },
    },
    {
      name: 'entities-only-depend-on-shared-or-self',
      comment: 'entities may not depend on other entities or higher layers',
      severity: 'error',
      from: { path: '^src/entities/' },
      to: { path: '^src/(app|pages|widgets|features)/' },
    },
    {
      name: 'features-may-not-depend-on-higher-layers',
      comment: 'features may only compose entities and shared modules',
      severity: 'error',
      from: { path: '^src/features/' },
      to: { path: '^src/(app|pages|widgets)/' },
    },
    {
      name: 'widgets-may-not-depend-on-pages-or-app',
      comment: 'widgets may only compose features, entities and shared modules',
      severity: 'error',
      from: { path: '^src/widgets/' },
      to: { path: '^src/(app|pages)/' },
    },
    {
      name: 'pages-may-not-depend-on-app',
      comment: 'pages are composed by app, not the other way around',
      severity: 'error',
      from: { path: '^src/pages/' },
      to: { path: '^src/app/' },
    },
    {
      name: 'no-deep-import-entities',
      comment: 'consumers must use an entity public API (its index.js)',
      severity: 'error',
      from: { path: '^src/(app|pages|widgets|features)/' },
      to: { path: '^src/entities/[^/]+/[^/]+/(?!index\\.js$)' },
    },
    {
      name: 'no-deep-import-features',
      comment: 'app, pages and widgets must use a feature public API',
      severity: 'error',
      from: { path: '^src/(app|pages|widgets)/' },
      to: { path: '^src/features/[^/]+/[^/]+/[^/]+/(?!index\\.js$)' },
    },
    {
      name: 'no-deep-import-widgets',
      comment: 'app and pages must use a widget public API (its index.js)',
      severity: 'error',
      from: { path: '^src/(app|pages)/' },
      to: { path: '^src/widgets/[^/]+/[^/]+/(?!index\\.js$)' },
    },
    // entities: src/entities/<domain>/<entity>.
    {
      name: 'no-cross-entity-import',
      comment: 'an entity may not depend on another entity, even in the same domain group',
      severity: 'error',
      from: { path: '^src/entities/([^/]+/[^/]+)/' },
      to: { path: '^src/entities/', pathNot: '^src/entities/$1/' },
    },
    // features: src/features/<cổng|common>/<module>/<slice>;
    // widgets:  src/widgets/<cổng|common>/<slice>.
    // $1 là slice nguồn (dependency-cruiser thay capture group của from.path).
    {
      name: 'no-cross-feature-import',
      comment: 'a feature may not depend on another feature, even in the same portal/module',
      severity: 'error',
      from: { path: '^src/features/([^/]+/[^/]+/[^/]+)/' },
      to: { path: '^src/features/', pathNot: '^src/features/$1/' },
    },
    {
      name: 'no-cross-widget-import',
      comment: 'a widget may not depend on another widget, even in the same portal group',
      severity: 'error',
      from: { path: '^src/widgets/([^/]+/[^/]+)/' },
      to: { path: '^src/widgets/', pathNot: '^src/widgets/$1/' },
    },
    {
      name: 'no-cross-portal-slice',
      comment: 'pages and widgets may only use features/widgets of their own portal or common',
      severity: 'error',
      from: { path: '^src/(?:pages|widgets)/([^/]+)/' },
      to: { path: '^src/(?:features|widgets)/(?!$1/|common/)[^/]+/' },
    },
    ...pagePortals.flatMap((portal) => {
      const otherPortals = pagePortals
        .filter((candidate) => candidate !== portal)
        .map(escapeRegExp)

      return otherPortals.length === 0
        ? []
        : [{
            name: `no-cross-page-portal-${portal}`,
            comment: `pages/${portal} may not depend on another portal's pages`,
            severity: 'error',
            from: { path: `^src/pages/${escapeRegExp(portal)}/` },
            to: { path: `^src/pages/(?:${otherPortals.join('|')})/` },
          }]
    }),
  ],
  options: {
    includeOnly: '^src/',
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'jsconfig.json' },
    enhancedResolveOptions: {
      extensions: ['.js', '.jsx'],
    },
  },
}
