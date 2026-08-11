import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import JobCategoryTreePicker from './JobCategoryTreePicker'

const categories = [
  { id: 1, name: 'Công nghệ thông tin', parent: null },
  { id: 10, name: 'Phát triển phần mềm', parent: 1 },
  { id: 100, name: 'Frontend Developer', parent: 10 },
  { id: 101, name: 'Backend Developer', parent: 10 },
  { id: 2, name: 'Kinh doanh', parent: null },
  { id: 20, name: 'Bán hàng', parent: 2 },
  { id: 200, name: 'Nhân viên kinh doanh', parent: 20 },
  { id: 3, name: 'Điều dưỡng', parent: null },
]

describe('JobCategoryTreePicker', () => {
  it('shows selected chips and applies the shortest multi-category selection', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <JobCategoryTreePicker
        ariaLabel="Ngành nghề"
        categories={categories}
        showSelectionChips
        value={[100]}
        onChange={onChange}
      />,
    )

    expect(screen.getByLabelText('Ngành nghề đã chọn')).toHaveTextContent('Frontend Developer')
    await user.click(screen.getByRole('button', { name: 'Ngành nghề' }))
    expect(screen.getByRole('dialog', { name: 'Chọn Danh mục nghề, Nghề hoặc Vị trí chuyên môn' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Chọn danh mục nghề Công nghệ thông tin' })).toBePartiallyChecked()

    await user.click(screen.getByRole('button', { name: 'Chọn vị trí chuyên môn Backend Developer' }))
    await user.click(screen.getByRole('button', { name: 'Chọn ngành nghề' }))

    // This fixture has one profession branch, so selecting both leaves reduces
    // all the way to the root group ID.
    expect(onChange).toHaveBeenCalledWith([1])
  })

  it('searches the full three-level taxonomy without accents', async () => {
    const user = userEvent.setup()
    render(<JobCategoryTreePicker ariaLabel="Ngành nghề" categories={categories} />)

    await user.click(screen.getByRole('button', { name: 'Ngành nghề' }))
    const searchInput = screen.getByRole('textbox', { name: 'Tìm kiếm ngành nghề' })
    await user.type(searchInput, 'backend')

    expect(screen.getByRole('button', { name: 'Chọn vị trí chuyên môn Backend Developer' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Chọn vị trí chuyên môn Frontend Developer' })).not.toBeInTheDocument()

    await user.clear(searchInput)
    await user.type(searchInput, 'dieu duong')
    expect(screen.getByRole('checkbox', { name: 'Chọn danh mục nghề Điều dưỡng' })).toBeInTheDocument()
  })

  it('opens a profession branch with keyboard navigation', async () => {
    const user = userEvent.setup()
    render(<JobCategoryTreePicker ariaLabel="Ngành nghề" categories={categories} />)

    await user.click(screen.getByRole('button', { name: 'Ngành nghề' }))
    const groupButton = screen.getByRole('button', { name: 'Mở danh mục nghề Kinh doanh' })
    groupButton.focus()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('checkbox', { name: 'Chọn nghề Bán hàng' })).toBeInTheDocument()
  })
})
