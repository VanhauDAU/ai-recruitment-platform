import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  forgetPreparedUpload,
  getUploadStatePresentation,
  prepareCleanUpload,
} from './upload-session'

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

vi.mock('./client', () => ({ default: { get, post } }))

describe('upload session API', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    get.mockReset()
    post.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uploads to quarantine and resolves only after the scanner reports clean', async () => {
    const file = new File(['%PDF-safe'], 'proof.pdf', { type: 'application/pdf' })
    post
      .mockResolvedValueOnce({ data: { public_id: 'ups_clean', state: 'uploading' } })
      .mockResolvedValueOnce({ data: { public_id: 'ups_clean', state: 'scanning' } })
    get.mockResolvedValueOnce({
      data: { public_id: 'ups_clean', state: 'clean', ready_for_submit: true },
    })
    const onStateChange = vi.fn()

    const resultPromise = prepareCleanUpload(file, 'employer_verification', { onStateChange })
    await vi.advanceTimersByTimeAsync(750)

    await expect(resultPromise).resolves.toMatchObject({
      public_id: 'ups_clean',
      ready_for_submit: true,
    })
    expect(post).toHaveBeenNthCalledWith(1, '/uploads/sessions/', {
      purpose: 'employer_verification',
      original_filename: 'proof.pdf',
      content_type: 'application/pdf',
      size_bytes: file.size,
    })
    expect(post.mock.calls[1][0]).toBe('/uploads/sessions/ups_clean/content/')
    expect(post.mock.calls[1][1]).toBeInstanceOf(FormData)
    expect(get).toHaveBeenCalledWith('/uploads/sessions/ups_clean/')
    expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'clean' }))
  })

  it('fails closed when the scanner rejects the file', async () => {
    const file = new File(['unsafe'], 'proof.pdf', { type: 'application/pdf' })
    post
      .mockResolvedValueOnce({ data: { public_id: 'ups_rejected', state: 'uploading' } })
      .mockResolvedValueOnce({
        data: {
          public_id: 'ups_rejected',
          state: 'rejected',
          result_code: 'malware_detected',
        },
      })

    await expect(prepareCleanUpload(file, 'employer_verification')).rejects.toMatchObject({
      response: { data: { state: 'rejected' } },
    })
    expect(get).not.toHaveBeenCalled()
  })

  it('uses concise presentation text for the visible scan lifecycle', () => {
    expect(getUploadStatePresentation({ state: 'scanning' })).toMatchObject({
      text: 'Tệp đang được kiểm tra an toàn…',
    })
    expect(getUploadStatePresentation({ state: 'clean' })).toMatchObject({
      text: 'Tệp đã vượt qua kiểm tra an toàn.',
    })
    expect(getUploadStatePresentation(null)).toBeNull()
  })

  it('can forget a prepared file after the business endpoint claims it', () => {
    const file = new File(['safe'], 'candidate.pdf', { type: 'application/pdf' })

    expect(() => forgetPreparedUpload(file, 'candidate_cv')).not.toThrow()
  })
})
