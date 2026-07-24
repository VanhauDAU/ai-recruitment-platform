import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { message } from 'antd'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CreateCampaignModal from './CreateCampaignModal'
import RenameCampaignModal from './RenameCampaignModal'

const mocks = vi.hoisted(() => ({
  createCampaign: vi.fn(),
  updateCampaign: vi.fn(),
}))

vi.mock('@/entities/campaign', () => ({
  campaignKeys: { all: ['campaigns'] },
  createCampaign: mocks.createCampaign,
  updateCampaign: mocks.updateCampaign,
}))

function renderModal(component) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

  return {
    invalidateQueries,
    ...render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>,
    ),
  }
}

describe('campaign create and rename modals', () => {
  beforeEach(() => {
    mocks.createCampaign.mockReset()
    mocks.updateCampaign.mockReset()
    vi.spyOn(message, 'error').mockImplementation(() => {})
    vi.spyOn(message, 'success').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a trimmed campaign, invalidates the canonical key and starts its activity flow', async () => {
    const user = userEvent.setup()
    const campaign = { public_id: 'camp_frontend', name: 'Tuyển Frontend' }
    const onClose = vi.fn()
    const onCreated = vi.fn()
    mocks.createCampaign.mockResolvedValue(campaign)
    const { invalidateQueries } = renderModal(
      <CreateCampaignModal
        open
        onClose={onClose}
        onCreated={onCreated}
      />,
    )

    await user.type(
      screen.getByLabelText('Tên chiến dịch tuyển dụng'),
      '  Tuyển Frontend  ',
    )
    await user.click(screen.getByRole('button', { name: 'Tạo chiến dịch' }))

    await waitFor(() => expect(mocks.createCampaign).toHaveBeenCalled())
    expect(mocks.createCampaign.mock.calls[0][0]).toEqual({
      name: 'Tuyển Frontend',
    })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['campaigns'] })
    expect(onClose).toHaveBeenCalledOnce()
    expect(onCreated).toHaveBeenCalledWith(campaign)
    expect(message.success).toHaveBeenCalledWith('Đã tạo và mở chiến dịch.')
  })

  it('keeps the create flow open and shows the API error when creation fails', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onCreated = vi.fn()
    mocks.createCampaign.mockRejectedValue({
      response: { status: 400, data: { name: ['Tên chiến dịch đã tồn tại.'] } },
    })
    const { invalidateQueries } = renderModal(
      <CreateCampaignModal
        open
        onClose={onClose}
        onCreated={onCreated}
      />,
    )

    await user.type(screen.getByLabelText('Tên chiến dịch tuyển dụng'), 'Đã có')
    await user.click(screen.getByRole('button', { name: 'Tạo chiến dịch' }))

    await waitFor(() => expect(message.error).toHaveBeenCalledWith(
      'Tên chiến dịch đã tồn tại.',
    ))
    expect(invalidateQueries).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('renames only the selected campaign and invalidates the canonical key', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    mocks.updateCampaign.mockResolvedValue({
      public_id: 'camp_frontend',
      name: 'Tuyển Backend',
    })
    const { invalidateQueries } = renderModal(
      <RenameCampaignModal
        campaign={{
          public_id: 'camp_frontend',
          name: 'Tuyển Frontend',
        }}
        onClose={onClose}
      />,
    )

    const input = await screen.findByDisplayValue('Tuyển Frontend')
    await user.clear(input)
    await user.type(input, '  Tuyển Backend  ')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    await waitFor(() => expect(mocks.updateCampaign).toHaveBeenCalledWith(
      'camp_frontend',
      { name: 'Tuyển Backend' },
    ))
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['campaigns'] })
    expect(onClose).toHaveBeenCalledOnce()
    expect(message.success).toHaveBeenCalledWith('Đã cập nhật chiến dịch.')
  })

  it('keeps the rename flow open and shows the API error when update fails', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    mocks.updateCampaign.mockRejectedValue({
      response: { status: 400, data: { detail: 'Không thể đổi tên lúc này.' } },
    })
    const { invalidateQueries } = renderModal(
      <RenameCampaignModal
        campaign={{
          public_id: 'camp_frontend',
          name: 'Tuyển Frontend',
        }}
        onClose={onClose}
      />,
    )

    const input = await screen.findByDisplayValue('Tuyển Frontend')
    await user.clear(input)
    await user.type(input, 'Tuyển Backend')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    await waitFor(() => expect(message.error).toHaveBeenCalledWith(
      'Không thể đổi tên lúc này.',
    ))
    expect(invalidateQueries).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
