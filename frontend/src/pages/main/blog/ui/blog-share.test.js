import { describe, expect, it } from 'vitest'
import { absoluteBlogShareUrl, buildBlogShareTargets } from './blog-share'

describe('blog share helpers', () => {
  it('builds facebook and twitter intents from a clean canonical url', () => {
    const targets = buildBlogShareTargets({
      url: 'https://procv.vn/blog/nhan-vien-sales-la-gi',
      title: 'Nhân viên Sales là gì?',
    })
    expect(targets.facebook).toBe(
      'https://www.facebook.com/sharer/sharer.php?u='
      + encodeURIComponent('https://procv.vn/blog/nhan-vien-sales-la-gi'),
    )
    expect(targets.twitter).toContain('https://twitter.com/intent/tweet?url=')
    expect(targets.twitter).toContain(encodeURIComponent('https://procv.vn/blog/nhan-vien-sales-la-gi'))
    expect(targets.twitter).toContain(encodeURIComponent('Nhân viên Sales là gì?'))
  })

  it('normalizes relative share paths', () => {
    expect(absoluteBlogShareUrl('blog/demo')).toMatch(/\/blog\/demo$/)
    expect(absoluteBlogShareUrl('/blog/demo')).toMatch(/\/blog\/demo$/)
  })
})
