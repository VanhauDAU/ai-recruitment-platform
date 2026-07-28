export const adminCompanyKeys = {
  all: ['admin-companies'],
  lists: () => [...adminCompanyKeys.all, 'list'],
  list: (params) => [...adminCompanyKeys.lists(), params],
  summary: ['admin-companies', 'summary'],
  details: () => [...adminCompanyKeys.all, 'detail'],
  detail: (publicId) => [...adminCompanyKeys.details(), publicId],
  recruiters: (publicId, params) => [
    ...adminCompanyKeys.detail(publicId),
    'recruiters',
    params,
  ],
}
