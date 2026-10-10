import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import DesiredPositionTagsInput from './DesiredPositionTagsInput'

function Harness({ limit = 5, onSuggestionSelect, suggestions = [] }) {
  const [positions, setPositions] = useState([])
  return (
    <DesiredPositionTagsInput
      availableSlots={limit - positions.length}
      onChange={setPositions}
      onSuggestionSelect={onSuggestionSelect}
      suggestions={suggestions}
      value={positions}
    />
  )
}

describe('DesiredPositionTagsInput', () => {
  it('creates a trimmed custom-position chip with Tab', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByRole('combobox', { name: 'Nhập vị trí chuyên môn không có trong danh mục' }), '  Kỹ sư dữ liệu  ')
    await user.tab()

    expect(screen.getByRole('listitem')).toHaveTextContent('Kỹ sư dữ liệu')
    expect(screen.getByRole('button', { name: 'Xóa vị trí Kỹ sư dữ liệu' })).toBeInTheDocument()
  })

  it('supports delimiters, case-insensitive dedupe and the custom-position limit', async () => {
    const user = userEvent.setup()
    render(<Harness limit={2} />)
    const input = screen.getByRole('combobox', { name: 'Nhập vị trí chuyên môn không có trong danh mục' })

    await user.type(input, 'Product Owner;')
    await user.type(input, 'product owner{Enter}')
    await user.type(input, 'Business Analyst{Enter}')

    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('Product Owner')).toBeInTheDocument()
    expect(screen.getByText('Business Analyst')).toBeInTheDocument()
    expect(input).toBeDisabled()
  })

  it('routes an exact taxonomy suggestion to its canonical id instead of creating a custom chip', async () => {
    const user = userEvent.setup()
    const onSuggestionSelect = vi.fn().mockReturnValue(true)
    render(
      <Harness
        onSuggestionSelect={onSuggestionSelect}
        suggestions={[{ id: 7, label: 'Kỹ sư phần mềm', value: 'Kỹ sư phần mềm' }]}
      />,
    )

    await user.type(screen.getByRole('combobox', { name: 'Nhập vị trí chuyên môn không có trong danh mục' }), 'kỹ SƯ phần mềm{Enter}')

    expect(onSuggestionSelect).toHaveBeenCalledWith(7)
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })
})
