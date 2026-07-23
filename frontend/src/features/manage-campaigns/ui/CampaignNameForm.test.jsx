import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CampaignNameForm from './CampaignNameForm'

describe('CampaignNameForm', () => {
  it('only edits the campaign name', async () => {
    const onSubmit = vi.fn()
    render(
      <CampaignNameForm
        initialName="Tuyển Frontend"
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    const input = screen.getByLabelText('Tên chiến dịch tuyển dụng')
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(input).toHaveValue('Tuyển Frontend')
    expect(screen.queryByText(/Mức lương|Kinh nghiệm|Ngân sách|Số lượng/)).not.toBeInTheDocument()

    fireEvent.change(input, { target: { value: '  Tuyển Backend  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: 'Tuyển Backend' }))
  })
})
