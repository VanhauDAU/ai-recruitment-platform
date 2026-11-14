import { describe, expect, it } from 'vitest'
import { companyVideoEmbed, parseCompanyVideoUrl } from './company-video'

describe('parseCompanyVideoUrl', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10', 'youtube', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/shorts/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://vimeo.com/76979871', 'vimeo', '76979871'],
    ['https://vimeo.com/channels/staffpicks/76979871', 'vimeo', '76979871'],
    ['https://player.vimeo.com/video/76979871', 'vimeo', '76979871'],
  ])('recognises %s', (url, provider, videoId) => {
    expect(parseCompanyVideoUrl(url)).toMatchObject({ provider, video_id: videoId })
  })

  it('builds the privacy-friendly embed URL', () => {
    expect(parseCompanyVideoUrl('https://youtu.be/dQw4w9WgXcQ').embed_url)
      .toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(parseCompanyVideoUrl('https://vimeo.com/76979871').embed_url).toBe('https://player.vimeo.com/video/76979871')
  })

  it.each([
    '',
    'not a url',
    'javascript:alert(1)//youtube.com/watch?v=dQw4w9WgXcQ',
    'https://evil.example/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=short',
    'https://vimeo.com/about',
  ])('rejects %s', (url) => {
    expect(parseCompanyVideoUrl(url)).toBeNull()
  })
})

describe('companyVideoEmbed', () => {
  it('accepts only the canonical embed URL of the declared video', () => {
    const section = { provider: 'youtube', video_id: 'dQw4w9WgXcQ', embed_url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' }

    expect(companyVideoEmbed(section)).toMatchObject({ provider: 'youtube' })
    expect(companyVideoEmbed({ ...section, embed_url: 'https://evil.example/embed/dQw4w9WgXcQ' })).toBeNull()
    expect(companyVideoEmbed({ embed_url: section.embed_url })).toBeNull()
    expect(companyVideoEmbed({ ...section, provider: 'dailymotion' })).toBeNull()
  })
})
