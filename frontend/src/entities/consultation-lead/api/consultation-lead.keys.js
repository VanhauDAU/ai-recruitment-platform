const adminLists = ['consultation-leads', 'admin', 'list']

export const consultationLeadKeys = {
  all: ['consultation-leads'],
  adminLists,
  adminList: ({ status = '', page = 1 } = {}) => [
    ...adminLists,
    { status, page },
  ],
}
