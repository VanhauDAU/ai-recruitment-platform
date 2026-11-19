// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  initialCrop, moveCrop, resizeCrop, validateAvatarDimensions, validateAvatarFile,
} from './avatar-crop'

describe('avatar crop model', () => {
  it('validates type, size and minimum dimensions', () => {
    expect(validateAvatarFile({ type: 'image/gif', size: 10 })).toMatch(/JPG, PNG hoặc WebP/)
    expect(validateAvatarFile({ type: 'image/png', size: 5 * 1024 * 1024 + 1 })).toMatch(/5 MB/)
    expect(validateAvatarFile({ type: 'image/webp', size: 1024 })).toBe('')
    expect(validateAvatarDimensions(640, 150)).toMatch(/tối thiểu 200×200/)
    expect(validateAvatarDimensions(200, 200)).toBe('')
  })

  it('starts with a centered square covering 80% of the short side', () => {
    expect(initialCrop(1000, 500)).toEqual({ x: 300, y: 50, size: 400 })
  })

  it('keeps the frame inside the image while dragging', () => {
    const crop = { x: 300, y: 50, size: 400 }
    expect(moveCrop(crop, 1000, -200, 1000, 500)).toEqual({ x: 600, y: 0, size: 400 })
    expect(moveCrop(crop, -50, 20, 1000, 500)).toEqual({ x: 250, y: 70, size: 400 })
  })

  it('resizes from a corner around the opposite anchor and clamps to bounds', () => {
    const crop = { x: 300, y: 50, size: 400 }
    // Kéo góc dưới-phải ra ngoài: bị chặn bởi mép dưới (500 - 50 = 450).
    expect(resizeCrop(crop, { sx: 1, sy: 1 }, 200, 200, 1000, 500)).toEqual({ x: 300, y: 50, size: 450 })
    // Kéo góc trên-trái vào trong: góc dưới-phải (700, 450) đứng yên.
    expect(resizeCrop(crop, { sx: -1, sy: -1 }, 100, 100, 1000, 500)).toEqual({ x: 400, y: 150, size: 300 })
    // Không nhỏ hơn 100px.
    expect(resizeCrop(crop, { sx: 1, sy: 1 }, -1000, -1000, 1000, 500).size).toBe(100)
  })
})
