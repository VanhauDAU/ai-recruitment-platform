// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { groupActivityByDay, parseActivityCategory } from './activity-timeline'

const NOW = new Date(2026, 10, 19, 15, 0)
const at = (day, hour) => new Date(2026, 10, day, hour, 30).toISOString()

describe('groupActivityByDay', () => {
  it('groups newest-first entries by local day with readable headings', () => {
    const groups = groupActivityByDay(
      [
        { id: 'a', occurred_at: at(19, 14) },
        { id: 'b', occurred_at: at(19, 8) },
        { id: 'c', occurred_at: at(18, 23) },
        { id: 'd', occurred_at: at(16, 9) },
      ],
      NOW,
    )
    expect(groups.map((group) => [group.label, group.entries.map((entry) => entry.id)])).toEqual([
      ['Hôm nay', ['a', 'b']],
      ['Hôm qua', ['c']],
      ['Thứ Hai, 16/11/2026', ['d']],
    ])
  })

  it('accepts only known categories from the URL', () => {
    expect(parseActivityCategory('security')).toBe('security')
    expect(parseActivityCategory('drop table')).toBe('')
  })
})
