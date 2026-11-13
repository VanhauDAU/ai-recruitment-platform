import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import layouts from './cv-layouts.json'

// Registry layout là hợp đồng giữa backend (validate, seed, PDF) và frontend
// (render). Hai bản phải giống hệt nhau.
describe('CV layout registry', () => {
  it('matches the backend registry', () => {
    const backend = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../../../backend/apps/cv_templates/layouts.json'), 'utf8'))
    expect(layouts).toEqual(backend)
  })

  it('keeps every row at 100 percent width', () => {
    for (const [key, layout] of Object.entries(layouts)) {
      const rows = {}
      layout.regions.forEach((region) => { rows[region.row] = (rows[region.row] || 0) + region.width })
      expect(Object.values(rows).every((total) => total === 100), key).toBe(true)
    }
  })
})
