export const adminCatalogKeys = {
  root: ['admin-catalog'],
  skills: (params = {}) => ['admin-catalog', 'skills', params],
  skillSummary: ['admin-catalog', 'skills', 'summary'],
  skillGroups: ['admin-catalog', 'skill-groups'],
  mergePreview: (sourceId, targetId) => ['admin-catalog', 'merge-preview', sourceId, targetId],
  categories: ['admin-catalog', 'categories'],
  lookup: (kind) => ['admin-catalog', 'lookup', kind],
}
