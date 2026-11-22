import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import FolderTabs from './FolderTabs'

const ITEMS = [
  { key: 'a', label: 'Một', children: <input aria-label="Ô một" /> },
  { key: 'b', label: 'Hai', children: <p>Nội dung hai</p> },
  { key: 'c', label: 'Ba', children: <p>Nội dung ba</p> },
]

function Harness(props) {
  const [active, setActive] = useState('a')
  return <FolderTabs idPrefix="t" ariaLabel="Mục" items={ITEMS} activeKey={active} onChange={setActive} {...props} />
}

describe('FolderTabs', () => {
  it('switches tabs by click and arrow keys, keeping visited panels mounted', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.getByRole('tablist', { name: 'Mục' })).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Ô một' }), 'đang nhập')

    await user.click(screen.getByRole('tab', { name: 'Hai' }))
    expect(screen.getByRole('tab', { name: 'Hai' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: 'Hai' })).toHaveTextContent('Nội dung hai')

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Ba' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Một' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('textbox', { name: 'Ô một' })).toHaveValue('đang nhập')

    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Ba' })).toHaveAttribute('aria-selected', 'true')
  })

  it('renders only the active panel with destroyInactive', async () => {
    const user = userEvent.setup()
    render(<Harness destroyInactive extra={<button type="button">Thêm</button>} />)
    expect(screen.getByRole('button', { name: 'Thêm' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Hai' }))
    expect(screen.queryByRole('textbox', { name: 'Ô một' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
  })
})
