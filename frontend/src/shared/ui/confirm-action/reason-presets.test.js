// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { applyReasonPreset } from './reason-presets'

const PRESETS = ['Ảnh mờ', 'Hết hạn']

describe('applyReasonPreset', () => {
  it('fills an empty reason and swaps one preset for another', () => {
    expect(applyReasonPreset('', 'Ảnh mờ', PRESETS)).toBe('Ảnh mờ')
    expect(applyReasonPreset('Ảnh mờ', 'Hết hạn', PRESETS)).toBe('Hết hạn')
  })

  it('appends to text the admin wrote and never duplicates', () => {
    expect(applyReasonPreset('Trang 2 bị thiếu', 'Ảnh mờ', PRESETS)).toBe('Trang 2 bị thiếu; Ảnh mờ')
    expect(applyReasonPreset('Trang 2 bị thiếu; Ảnh mờ', 'Ảnh mờ', PRESETS)).toBe('Trang 2 bị thiếu; Ảnh mờ')
  })
})
