import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Grid } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { skillListParams } from '../model/catalog'
import SkillCatalog from './SkillCatalog'

const api = vi.hoisted(() => ({
  getAdminSkills: vi.fn(),
  getAdminSkillSummary: vi.fn(),
  getAdminSkillGroups: vi.fn(),
  updateAdminSkill: vi.fn(),
  bulkUpdateAdminSkills: vi.fn(),
}))
const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }))

vi.mock('@/entities/system/admin-catalog', async (importOriginal) => ({ ...(await importOriginal()), ...api }))
vi.mock('@/entities/account/session', () => ({ useSession: () => ({ user: { admin_access: { is_superuser: true } } }) }))
vi.mock('@/shared/lib/toast', () => ({ message: toast }))

const usage = { jobs: 12, cvs: 3, candidates: 0 }
const skills = [
  { id: 1, name: 'ReactJS', aliases: ['React.js', 'React', 'ReactJS 18'], group: null, group_name: '', source: 'employer', is_active: true, usage, usage_total: 15, created_at: '2026-11-20T00:00:00Z' },
  { id: 2, name: 'Django', aliases: [], group: 5, group_name: 'Backend', source: 'seed', is_active: true, usage: { jobs: 0, cvs: 0, candidates: 0 }, usage_total: 0, created_at: '2026-11-20T00:00:00Z' },
]

function renderCatalog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><SkillCatalog /></QueryClientProvider>)
}

describe('SkillCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(Grid, 'useBreakpoint').mockReturnValue({ md: true })
    api.getAdminSkills.mockResolvedValue({ count: 2, results: skills })
    api.getAdminSkillSummary.mockResolvedValue({ ungrouped: 1, duplicates: 0 })
    api.getAdminSkillGroups.mockResolvedValue([{ id: 5, name: 'Backend', is_active: true, skill_count: 1, is_system: false, parent: null }])
    api.updateAdminSkill.mockResolvedValue({})
    api.bulkUpdateAdminSkills.mockResolvedValue({})
  })

  it('shows usage, source and only the cleanup chips that still have work', async () => {
    renderCatalog()
    expect(await screen.findByText('ReactJS')).toBeInTheDocument()
    expect(screen.getByText('NTD thêm')).toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '1 chưa có nhóm' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /có thể trùng/ })).not.toBeInTheDocument()
  })

  it('filters by a cleanup chip', async () => {
    renderCatalog()
    fireEvent.click(await screen.findByRole('button', { name: '1 chưa có nhóm' }))
    await waitFor(() => expect(api.getAdminSkills).toHaveBeenLastCalledWith(
      expect.objectContaining({ ungrouped: true, page: 1 }),
      expect.anything(),
    ))
  })

  it('hides a skill at once and offers undo', async () => {
    renderCatalog()
    fireEvent.click(await screen.findByRole('switch', { name: 'Hiện ReactJS' }))
    await waitFor(() => expect(api.updateAdminSkill).toHaveBeenCalledWith(1, { is_active: false }))
    const [text, options] = toast.mock.calls.at(-1)
    expect(text).toBe('Đã ẩn “ReactJS”')
    options.action.onClick()
    await waitFor(() => expect(api.updateAdminSkill).toHaveBeenLastCalledWith(1, { is_active: true }))
  })

  it('swaps the filters for a bulk bar while rows are selected', async () => {
    renderCatalog()
    await screen.findByText('ReactJS')
    fireEvent.click(screen.getAllByRole('checkbox')[1])
    expect(screen.getByRole('toolbar', { name: 'Thao tác với các kỹ năng đã chọn' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ẩn' }))
    await waitFor(() => expect(api.bulkUpdateAdminSkills).toHaveBeenCalledWith([1], { is_active: false }))
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
  })
})

describe('skillListParams', () => {
  it('maps filters to API parameters', () => {
    expect(skillListParams({ search: ' go ', group: 5, source: undefined, status: 'hidden', ordering: 'usage', cleanup: 'duplicates' }, 2))
      .toEqual({ page: 2, page_size: 50, ordering: 'usage', search: 'go', group: 5, is_active: false, duplicates: true })
  })
})
