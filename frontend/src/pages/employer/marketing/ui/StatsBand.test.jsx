import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StatsBand from './StatsBand'

vi.mock('@/entities/system/site-settings', async (importOriginal) => ({
  ...await importOriginal(),
  useSiteSettings: () => ({
    settings: { employer_stats: [{ value: '24/7', label_vi: 'hỗ trợ trực tuyến', label_en: 'online support' }] },
  }),
}))

describe('StatsBand', () => {
  it('renders the admin-configured list (an array, not a string setting)', () => {
    render(<StatsBand title="Số liệu" />)

    expect(screen.getByText('24/7')).toBeInTheDocument()
    expect(screen.getByText('hỗ trợ trực tuyến')).toBeInTheDocument()
  })
})
