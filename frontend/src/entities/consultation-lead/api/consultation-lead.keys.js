const adminLists = ['consultation-leads', 'admin', 'list']

export const consultationLeadKeys = {
  all: ['consultation-leads'],
  adminLists,
  adminList: (params = {}) => [
    ...adminLists,
    params,
  ],
}
