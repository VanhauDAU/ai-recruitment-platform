import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SettingListEditor from './SettingListEditor'

describe('SettingListEditor', () => {
  it('edits, reorders and removes rows of the declared fields', () => {
    const onChange = vi.fn()
    const rows = [{ value: '10+', label_vi: 'tin' }, { value: '24/7', label_vi: 'hỗ trợ' }]
    render(<SettingListEditor fields={['value', 'label_vi']} value={rows} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Giá trị 1'), { target: { value: '20+' } })
    expect(onChange).toHaveBeenLastCalledWith([{ value: '20+', label_vi: 'tin' }, rows[1]])

    fireEvent.click(screen.getByLabelText('Đưa dòng 2 lên'))
    expect(onChange).toHaveBeenLastCalledWith([rows[1], rows[0]])

    fireEvent.click(screen.getByLabelText('Xoá dòng 1'))
    expect(onChange).toHaveBeenLastCalledWith([rows[1]])
  })

  it('explains that an empty list hides the block and can add a row', () => {
    const onChange = vi.fn()
    render(<SettingListEditor fields={['logo_url']} value={[]} onChange={onChange} />)

    expect(screen.getByText('Chưa có dòng nào, khối này sẽ được ẩn.')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Thêm dòng'))
    expect(onChange).toHaveBeenCalledWith([{}])
  })
})
