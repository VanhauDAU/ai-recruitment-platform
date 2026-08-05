import { describe, expect, it } from 'vitest'
import { groupVerificationDocuments } from './document-groups'

describe('groupVerificationDocuments', () => {
  it('groups representative, business and privacy documents without losing duplicates', () => {
    const groups = groupVerificationDocuments([
      { public_id: 'doc_auth', doc_type: 'authorization_letter' },
      { public_id: 'doc_id_front', doc_type: 'identity_document' },
      { public_id: 'doc_id_back', doc_type: 'identity_document' },
      { public_id: 'doc_business', doc_type: 'business_registration' },
      { public_id: 'doc_dpa', doc_type: 'data_processing_agreement' },
    ])

    expect(groups.map((group) => group.title)).toEqual([
      'Quyền đại diện',
      'Pháp lý doanh nghiệp',
      'Bảo vệ dữ liệu',
    ])
    expect(groups[0].documents.map((document) => document.public_id)).toEqual([
      'doc_auth',
      'doc_id_front',
      'doc_id_back',
    ])
  })

  it('keeps unknown document types in a separate group', () => {
    const groups = groupVerificationDocuments([
      { public_id: 'doc_other', doc_type: 'supporting_document' },
    ])

    expect(groups).toEqual([
      expect.objectContaining({
        key: 'other',
        title: 'Giấy tờ khác',
        documents: [{ public_id: 'doc_other', doc_type: 'supporting_document' }],
      }),
    ])
  })
})
