import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PositionDetailField from './PositionDetailField'

vi.mock('./InlineText', () => ({
  default: ({ value, ariaLabel, onCommit }) => <input aria-label={ariaLabel} defaultValue={value} onBlur={(event) => onCommit(event.target.value)} />,
}))

const item = (field_type, value = '', extra = {}) => ({ item_id: 'pd_1', field_key: 'f', label: 'Trường', field_type, value, ...extra })

function commit(fieldItem, text) {
  const onChange = vi.fn()
  const view = render(<PositionDetailField item={fieldItem} onChange={onChange} />)
  fireEvent.blur(screen.getByLabelText('Trường pd_1'), { target: { value: text } })
  view.unmount()
  return onChange
}

describe('PositionDetailField', () => {
  it('stores values in the type the CV schema expects', () => {
    expect(commit(item('number', null), '12,5')).toHaveBeenCalledWith({ value: 12.5 })
    expect(commit(item('url'), 'github.com/an')).toHaveBeenCalledWith({ value: 'https://github.com/an' })
    expect(commit(item('date', null), '2024-05')).toHaveBeenCalledWith({ value: '2024-05' })
    expect(commit(item('text', 'x'), '  ')).toHaveBeenCalledWith({ value: '' })
  })

  it('ignores input that is not a valid number or month', () => {
    expect(commit(item('number', 3), 'ba năm')).not.toHaveBeenCalled()
    expect(commit(item('date', null), '05/2024')).not.toHaveBeenCalled()
  })

  it('offers the position options for choice fields', () => {
    render(<PositionDetailField item={item('select', 'B2B', { options: ['B2B', 'B2C'] })} onChange={vi.fn()} />)

    expect(screen.getByText('Trường')).toBeInTheDocument()
    expect(screen.getByText('B2B')).toBeInTheDocument()
  })
})
