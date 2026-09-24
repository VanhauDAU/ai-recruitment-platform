import { App } from 'antd'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SampleLibraryPanel from './panels/SampleLibraryPanel'
import TemplateSwitcher from './TemplateSwitcher'

const mocks = vi.hoisted(() => ({
  getCvSampleContents: vi.fn(),
  getCvTemplate: vi.fn(),
  getCvTemplates: vi.fn(),
}))

vi.mock('@/entities/cv-template', () => mocks)

describe('CV content confirmations', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.getCvTemplates.mockResolvedValue({
      results: [
        { public_id: 'template-current', display_name: 'Mẫu hiện tại', slug: 'current' },
        { public_id: 'template-new', display_name: 'Mẫu mới', slug: 'new' },
      ],
    })
    mocks.getCvTemplate.mockResolvedValue({ sections: [{ section_key: 'summary' }] })
    mocks.getCvSampleContents.mockResolvedValue([
      { public_id: 'sample-1', title: 'Nội dung Marketing', position_name_vi: 'Marketing Executive' },
    ])
  })

  it('confirms a template switch and explains sections that will be hidden', async () => {
    const user = userEvent.setup()
    const onSwitch = vi.fn().mockResolvedValue({ draft: {} })
    render(
      <App>
        <TemplateSwitcher
          currentTemplatePublicId="template-current"
          currentSections={[
            { instance_id: 'summary-1', section_key: 'summary', title: 'Mục tiêu' },
            { instance_id: 'skills-1', section_key: 'skills', title: 'Kỹ năng' },
          ]}
          locale="vi-VN"
          onSwitch={onSwitch}
        />
      </App>,
    )

    await user.click(await screen.findByRole('button', { name: 'Mẫu mới' }))
    await user.click(screen.getByRole('button', { name: 'Áp dụng mẫu CV' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Đổi mẫu CV' })).toBeInTheDocument()
    expect(within(dialog).getByText('Kỹ năng')).toBeInTheDocument()
    expect(onSwitch).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Đổi mẫu' }))

    await waitFor(() => expect(onSwitch).toHaveBeenCalledWith('template-new'))
  })

  it('confirms before replacing CV content with a sample', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn().mockResolvedValue({ public_id: 'draft-1' })
    render(<App><SampleLibraryPanel locale="vi-VN" onApply={onApply} /></App>)

    await user.click(await screen.findByRole('button', { name: /Nội dung Marketing/ }))

    const dialog = await screen.findByRole('dialog', { name: 'Sử dụng nội dung mẫu' })
    expect(onApply).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Sử dụng mẫu' }))

    await waitFor(() => expect(onApply).toHaveBeenCalledWith('sample-1'))
  })

  it('keeps the template confirmation open when the switch is not saved', async () => {
    const user = userEvent.setup()
    const onSwitch = vi.fn().mockResolvedValue(null)
    render(
      <App>
        <TemplateSwitcher
          currentTemplatePublicId="template-current"
          currentSections={[]}
          locale="vi-VN"
          onSwitch={onSwitch}
        />
      </App>,
    )

    await user.click(await screen.findByRole('button', { name: 'Mẫu mới' }))
    await user.click(screen.getByRole('button', { name: 'Áp dụng mẫu CV' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Đổi mẫu CV' })).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Đổi mẫu' }))

    await waitFor(() => expect(onSwitch).toHaveBeenCalledOnce())
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('keeps the sample confirmation open when applying the sample fails', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn().mockResolvedValue(null)
    render(<App><SampleLibraryPanel locale="vi-VN" onApply={onApply} /></App>)

    await user.click(await screen.findByRole('button', { name: /Nội dung Marketing/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Sử dụng nội dung mẫu' })
    await user.click(within(dialog).getByRole('button', { name: 'Sử dụng mẫu' }))

    await waitFor(() => expect(onApply).toHaveBeenCalledOnce())
    expect(screen.getByRole('dialog', { name: 'Sử dụng nội dung mẫu' })).toBeInTheDocument()
  })
})
