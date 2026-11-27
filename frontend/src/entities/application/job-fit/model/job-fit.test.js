import { describe, expect, it } from 'vitest'
import { groupMissingSkills } from './job-fit'

describe('groupMissingSkills', () => {
  it('gộp các kỹ năng thay thế nhau thành một mục, giữ nguyên kỹ năng đứng riêng', () => {
    const missing = [
      { name: 'Golang', importance: 'required', group: 1 },
      { name: 'Docker', importance: 'preferred' },
      { name: 'PHP', importance: 'required', group: 1 },
    ]

    expect(groupMissingSkills(missing)).toEqual([
      { key: 'group-1', names: ['Golang', 'PHP'], importance: 'required' },
      { key: 'Docker', names: ['Docker'], importance: 'preferred' },
    ])
    expect(groupMissingSkills()).toEqual([])
  })
})
