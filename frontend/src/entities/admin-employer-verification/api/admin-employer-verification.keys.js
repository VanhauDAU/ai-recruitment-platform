const root = ['admin-employer-verifications']

export const adminEmployerVerificationKeys = {
  all: root,
  summary: [...root, 'summary'],
  list: (params = {}) => [...root, 'list', params],
  detail: (publicId) => [...root, 'detail', publicId],
  document: (casePublicId, documentPublicId) => [
    ...root,
    'document',
    casePublicId,
    documentPublicId,
  ],
}
