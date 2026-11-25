import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildCategoryTree, categoryMatcher, filterCategoryTree, foldText, parentOptions } from '../model/category-tree'
import CategoryCatalog from './CategoryCatalog'
import LookupCatalog from './LookupCatalog'

const api = vi.hoisted(() => ({
  getAdminJobCategories: vi.fn(),
  updateAdminJobCategory: vi.fn(),
  getAdminLookup: vi.fn(),
  updateAdminLookup: vi.fn(),
  createAdminLookup: vi.fn(),
  reorderAdminBenefits: vi.fn(),
}))
const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }))

vi.mock('@/entities/system/admin-catalog', async (importOriginal) => ({ ...(await importOriginal()), ...api }))
vi.mock('@/shared/lib/toast', () => ({ message: toast }))

const row = (id, name, category_type, parent = null, extra = {}) => ({
  id, name, category_type, parent, name_en: '', status: 'active', job_count: 0, child_count: 0, logo_preview: null, ...extra,
})
const CATEGORIES = [
  row(1, 'Công nghệ thông tin', 'occupation_group', null, { child_count: 1 }),
  row(2, 'Phát triển phần mềm', 'domain', 1, { child_count: 1 }),
  row(3, 'Lập trình viên Backend', 'specialization', 2, { name_en: 'Backend Developer', job_count: 7 }),
  row(4, 'Kế toán', 'occupation_group'),
]

function renderWithClient(node) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
}

describe('category tree model', () => {
  it('builds the tree, keeps ancestors of matches and folds Vietnamese accents', () => {
    const tree = buildCategoryTree(CATEGORIES)
    expect(tree.map((node) => node.name)).toEqual(['Công nghệ thông tin', 'Kế toán'])
    expect(tree[1].children).toBeUndefined()
    expect(tree[0].branch_job_count).toBe(7)

    const matches = filterCategoryTree(tree, categoryMatcher({ search: 'lap trinh', type: '', status: 'all' }))
    expect(matches).toHaveLength(1)
    expect(matches[0].children[0].children[0].name).toBe('Lập trình viên Backend')
    expect(foldText('Đà Nẵng')).toBe('da nang')
  })

  it('offers only parents on the level of the current parent', () => {
    const options = parentOptions(CATEGORIES, CATEGORIES[1])
    expect(options.map((option) => option.label)).toEqual(['Công nghệ thông tin', 'Kế toán'])
  })
})

describe('CategoryCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getAdminJobCategories.mockResolvedValue(CATEGORIES)
    api.updateAdminJobCategory.mockResolvedValue({})
  })

  it('opens the branches that lead to a search match', async () => {
    renderWithClient(<CategoryCatalog />)
    await screen.findByText('Công nghệ thông tin')
    expect(screen.queryByText('Backend Developer')).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm ngành nghề…' }), { target: { value: 'backend' } })
    expect(await screen.findByText('Backend Developer')).toBeInTheDocument()
    expect(screen.queryByText('Kế toán')).not.toBeInTheDocument()
  })

  it('warns that children stay visible when hiding a branch', async () => {
    renderWithClient(<CategoryCatalog />)
    fireEvent.click(await screen.findByRole('switch', { name: 'Hiện Công nghệ thông tin' }))
    await waitFor(() => expect(api.updateAdminJobCategory).toHaveBeenCalledWith(1, { status: 'inactive' }))
    expect(toast.mock.calls.at(-1)[0]).toBe('Đã ẩn “Công nghệ thông tin”, 1 mục con vẫn hiện')
  })
})

describe('LookupCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getAdminLookup.mockResolvedValue([
      { id: 1, name: 'Ăn trưa', category: 'allowance', is_active: true, sort_order: 0, job_count: 3, company_count: 1 },
      { id: 2, name: 'Laptop', category: 'equipment', is_active: true, sort_order: 1, job_count: 0, company_count: 0 },
    ])
    api.reorderAdminBenefits.mockResolvedValue([])
    api.createAdminLookup.mockResolvedValue({ id: 3, name: 'Gửi xe' })
  })

  it('reorders benefits and adds one with its group', async () => {
    renderWithClient(<LookupCatalog kind="benefits" />)
    expect(await screen.findByText('Ăn trưa')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Đưa Laptop lên' }))
    await waitFor(() => expect(api.reorderAdminBenefits).toHaveBeenCalledWith([2, 1]))

    fireEvent.change(screen.getByRole('textbox', { name: 'Tên phúc lợi mới' }), { target: { value: ' Gửi xe ' } })
    fireEvent.click(screen.getByRole('button', { name: /Thêm/ }))
    await waitFor(() => expect(api.createAdminLookup).toHaveBeenCalledWith('benefits', { name: 'Gửi xe', category: 'other' }))
  })
})
