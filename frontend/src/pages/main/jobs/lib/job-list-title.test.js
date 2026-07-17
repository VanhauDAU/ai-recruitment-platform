import { describe, expect, it } from 'vitest'
import { buildJobListTitle } from './job-list-title'

describe('job list title', () => {
  it('uses the result count, active context, and update label shown in the page heading', () => {
    expect(buildJobListTitle({
      count: '4',
      contextLabel: 'Nhan Vien - Frontend Developer',
      loading: false,
      updateLabel: '[Update 18/07/2026]',
    })).toBe('Tuyển dụng 4 việc làm Nhan Vien - Frontend Developer [Update 18/07/2026]')
  })

  it('does not show a stale zero-result count while results are loading', () => {
    expect(buildJobListTitle({
      count: '0',
      contextLabel: 'Frontend Developer',
      loading: true,
      updateLabel: '[Update 18/07/2026]',
    })).toBe('Tuyển dụng việc làm Frontend Developer [Update 18/07/2026]')
  })
})
