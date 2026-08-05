const DOCUMENT_GROUPS = [
  {
    key: 'representative',
    title: 'Quyền đại diện',
    description: 'Giấy ủy quyền và giấy tờ định danh của người đại diện.',
    types: ['authorization_letter', 'identity_document'],
  },
  {
    key: 'business',
    title: 'Pháp lý doanh nghiệp',
    description: 'Đăng ký doanh nghiệp và bằng chứng tên thương mại.',
    types: ['business_registration', 'trade_name_proof'],
  },
  {
    key: 'privacy',
    title: 'Bảo vệ dữ liệu',
    description: 'Thỏa thuận xử lý dữ liệu cá nhân với ứng viên.',
    types: ['data_processing_agreement'],
  },
]

export function groupVerificationDocuments(documents = []) {
  const knownTypes = new Set(DOCUMENT_GROUPS.flatMap((group) => group.types))
  const groups = DOCUMENT_GROUPS.map((group) => ({
    ...group,
    documents: documents.filter((document) => group.types.includes(document.doc_type)),
  })).filter((group) => group.documents.length > 0)
  const otherDocuments = documents.filter((document) => !knownTypes.has(document.doc_type))

  if (otherDocuments.length > 0) {
    groups.push({
      key: 'other',
      title: 'Giấy tờ khác',
      description: 'Tài liệu bổ sung chưa thuộc nhóm chuẩn.',
      types: [],
      documents: otherDocuments,
    })
  }
  return groups
}
