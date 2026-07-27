import { describe, expect, it } from 'vitest'
import { generateAccessCode } from './generate-access-code'

describe('generateAccessCode', () => {
  it('creates a stable backend-safe code from a Vietnamese display name', () => {
    expect(generateAccessCode('  Nội dung & CV  ')).toBe('noi-dung-cv')
    expect(generateAccessCode('Trưởng phòng — Kiểm duyệt')).toBe('truong-phong-kiem-duyet')
  })

  it('returns an empty preview until a name is entered', () => {
    expect(generateAccessCode('')).toBe('')
  })
})
