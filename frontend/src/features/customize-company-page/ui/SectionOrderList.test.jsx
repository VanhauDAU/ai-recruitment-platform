import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SectionOrderList from './SectionOrderList'

const SECTIONS = [
  { key: 'about', title: 'Giới thiệu công ty', zone: 'main', always_on: false },
  { key: 'jobs', title: 'Việc làm đang tuyển', zone: 'main', always_on: true },
  { key: 'benefits', title: 'Phúc lợi', zone: 'main', always_on: false },
  { key: 'general_info', title: 'Thông tin chung', zone: 'sidebar', always_on: true },
  { key: 'offices', title: 'Địa điểm', zone: 'sidebar', always_on: false },
]

function renderList(props = {}) {
  const onChange = vi.fn()
  render(
    <SectionOrderList
      sections={SECTIONS}
      order={['about', 'jobs', 'benefits']}
      hidden={['offices']}
      contentKeys={new Set(['about', 'jobs', 'general_info', 'offices'])}
      onChange={onChange}
      {...props}
    />,
  )
  return onChange
}

describe('SectionOrderList', () => {
  it('lists main sections in draft order and marks the ones without content', () => {
    renderList({ order: ['benefits', 'about', 'jobs'] })

    const main = within(screen.getByRole('list', { name: 'Khối cột chính' })).getAllByRole('listitem')
    expect(main.map((row) => row.textContent.replace('Chưa có nội dung', '').replace('Luôn hiển thị', '').trim()))
      .toEqual(['Phúc lợi', 'Giới thiệu công ty', 'Việc làm đang tuyển'])
    expect(within(main[0]).getByText('Chưa có nội dung')).toBeInTheDocument()
    expect(within(main[1]).queryByText('Chưa có nội dung')).not.toBeInTheDocument()
  })

  it('toggles visibility through the switch of a toggleable section', async () => {
    const user = userEvent.setup()
    const onChange = renderList()

    await user.click(screen.getByRole('switch', { name: 'Hiển thị Phúc lợi' }))
    expect(onChange).toHaveBeenLastCalledWith({ hidden_sections: ['offices', 'benefits'] })

    const offices = screen.getByRole('switch', { name: 'Hiển thị Địa điểm' })
    expect(offices).not.toBeChecked()
    await user.click(offices)
    expect(onChange).toHaveBeenLastCalledWith({ hidden_sections: [] })
  })

  it('reorders main sections with the arrow buttons and stops at both ends', async () => {
    const user = userEvent.setup()
    const onChange = renderList()

    expect(screen.getByRole('button', { name: 'Chuyển Giới thiệu công ty lên' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Chuyển Phúc lợi xuống' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Chuyển Phúc lợi lên' }))
    expect(onChange).toHaveBeenLastCalledWith({ section_order: ['about', 'benefits', 'jobs'] })

    await user.click(screen.getByRole('button', { name: 'Chuyển Giới thiệu công ty xuống' }))
    expect(onChange).toHaveBeenLastCalledWith({ section_order: ['jobs', 'about', 'benefits'] })
  })

  it('locks always-on rows and keeps sidebar rows out of reordering', () => {
    renderList()

    expect(screen.queryByRole('switch', { name: 'Hiển thị Việc làm đang tuyển' })).not.toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'Hiển thị Thông tin chung' })).not.toBeInTheDocument()
    expect(screen.getAllByText('Luôn hiển thị')).toHaveLength(2)
    const sidebar = screen.getByRole('list', { name: 'Khối cột bên' })
    expect(within(sidebar).queryByRole('button')).not.toBeInTheDocument()
  })

  it('disables every control for a read-only viewer', () => {
    renderList({ disabled: true })

    screen.getAllByRole('switch').forEach((control) => expect(control).toBeDisabled())
    screen.getAllByRole('button').forEach((control) => expect(control).toBeDisabled())
  })
})
