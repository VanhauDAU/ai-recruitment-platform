const { readdirSync } = require('node:fs')
const { join } = require('node:path')

// Đọc slice từ filesystem để slice mới tự động được áp rule, không cần nhớ
// cập nhật danh sách hardcode (trước đây thiếu 7 feature và 2 widget).
const listSlices = (layer) =>
  readdirSync(join(__dirname, 'src', layer), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

const featureSlices = listSlices('features')
const widgetSlices = listSlices('widgets')

module.exports = {
  forbidden: [
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
      to: { path: '^src/entities/[^/]+/(?!index\\.js$)' },
    },
    {
      name: 'no-deep-import-features',
      comment: 'app, pages and widgets must use a feature public API',
      severity: 'error',
      from: { path: '^src/(app|pages|widgets)/' },
      to: { path: '^src/features/[^/]+/(?!index\\.js$)' },
    },
    {
      name: 'no-deep-import-widgets',
      comment: 'app and pages must use a widget public API (its index.js)',
      severity: 'error',
      from: { path: '^src/(app|pages)/' },
      to: { path: '^src/widgets/[^/]+/(?!index\\.js$)' },
    },
    ...featureSlices.map((slice) => ({
      name: `no-cross-feature-import-${slice}`,
      comment: `features/${slice} may not depend on another feature`,
      severity: 'error',
      from: { path: `^src/features/${slice}/` },
      to: { path: `^src/features/(?!${slice}/)` },
    })),
    ...widgetSlices.map((slice) => ({
      name: `no-cross-widget-import-${slice}`,
      comment: `widgets/${slice} may not depend on another widget`,
      severity: 'error',
      from: { path: `^src/widgets/${slice}/` },
      to: { path: `^src/widgets/(?!${slice}/)` },
    })),
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
