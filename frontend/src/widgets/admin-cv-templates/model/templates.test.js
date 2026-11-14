import { describe, expect, it } from 'vitest'
import { RENDERER_CONTRACTS } from '@/entities/cv'
import { SECTION_STATES, draftVersion, failingChecks, replaceVersion, resizablePair, sectionFlags, sectionState } from './templates'

describe('admin template model', () => {
  it('folds the two section flags into one choice and back', () => {
    expect(SECTION_STATES.map(({ value }) => sectionState(sectionFlags(value)))).toEqual(['required', 'on', 'off'])
    // Bắt buộc luôn kéo theo bật sẵn.
    expect(sectionState({ is_required: true, is_default_enabled: false })).toBe('required')
  })

  it('replaces a saved version in the cached template, or adds a new draft first', () => {
    const template = { versions: [{ id: 1, version_status: 'published' }] }
    const draft = { id: 2, version_status: 'draft' }

    const withDraft = replaceVersion(template, draft)
    expect(withDraft.versions.map((version) => version.id)).toEqual([2, 1])
    expect(draftVersion(withDraft)).toBe(draft)
    expect(replaceVersion(withDraft, { ...draft, renderer_key: 'timeline_v1' }).versions[0].renderer_key).toBe('timeline_v1')
  })

  it('finds the resizable column pair only for layouts with two columns side by side', () => {
    expect(resizablePair(RENDERER_CONTRACTS.header_band_two_column_v1).map((region) => region.id)).toEqual(['main', 'sidebar'])
    expect(resizablePair(RENDERER_CONTRACTS.single_column_v1)).toBeNull()
    expect(failingChecks({ items: [{ key: 'names', ok: true }, { key: 'test_pdf', ok: false }] }).map((item) => item.key)).toEqual(['test_pdf'])
  })
})
