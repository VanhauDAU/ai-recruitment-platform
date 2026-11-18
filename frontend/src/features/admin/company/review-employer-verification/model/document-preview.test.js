import { describe, expect, it } from 'vitest'
import {
  documentPreviewKind,
  resolveDocumentMimeType,
} from './document-preview'

describe('employer verification document preview', () => {
  it.each([
    ['image/jpg', 'image/jpeg'],
    ['image/pjpeg', 'image/jpeg'],
    ['image/x-png', 'image/png'],
    ['image/webp', 'image/webp'],
    ['image/gif', 'image/gif'],
    ['image/avif', 'image/avif'],
  ])('normalizes %s as a browser image type', (input, expected) => {
    const mimeType = resolveDocumentMimeType({ responseMimeType: input })
    expect(mimeType).toBe(expected)
    expect(documentPreviewKind(mimeType)).toBe('image')
  })

  it('uses the response MIME type for legacy documents with an empty stored MIME', () => {
    expect(resolveDocumentMimeType({
      responseMimeType: 'image/png; charset=binary',
      storedMimeType: '',
      fileName: 'Giấy đăng ký doanh nghiệp',
    })).toBe('image/png')
  })

  it('falls back to the extension when both API MIME values are generic', () => {
    expect(resolveDocumentMimeType({
      responseMimeType: 'application/octet-stream',
      storedMimeType: '',
      fileName: 'registration.WEBP',
    })).toBe('image/webp')
  })

  it('keeps office documents download-only', () => {
    expect(documentPreviewKind(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )).toBe('download')
  })

  it('uses a converted PDF response to preview an office document', () => {
    const mimeType = resolveDocumentMimeType({
      responseMimeType: 'application/pdf',
      storedMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileName: 'thoa-thuan.docx',
    })

    expect(mimeType).toBe('application/pdf')
    expect(documentPreviewKind(mimeType)).toBe('pdf')
  })
})
