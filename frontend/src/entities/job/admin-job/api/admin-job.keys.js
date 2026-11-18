export const adminJobKeys = {
  all: ['admin-jobs'],
  lists: () => [...adminJobKeys.all, 'list'],
  list: (params) => [...adminJobKeys.lists(), params],
  summary: ['admin-jobs', 'summary'],
  details: () => [...adminJobKeys.all, 'detail'],
  detail: (publicId) => [...adminJobKeys.details(), publicId],
}
