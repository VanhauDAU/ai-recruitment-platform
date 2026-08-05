import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Form } from 'antd'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_SURFACES,
} from '@/entities/announcement'
import AnnouncementCtaFields from './AnnouncementCtaFields'
import {
  PreviewStep,
  TargetStep,
} from './AnnouncementEditorSteps'

function mockMobileViewport() {
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: query === '(max-width: 640px)',
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  }))
}

function CtaFieldsHarness({ ctaUrl }) {
  const [form] = Form.useForm()
  return (
    <Form
      form={form}
      initialValues={{
        cta_label_vi: 'Đăng tin',
        cta_mode: 'internal',
        cta_url: ctaUrl,
      }}
    >
      <AnnouncementCtaFields
        audiences={[ANNOUNCEMENT_AUDIENCES.GUEST]}
        ctaMode="internal"
        form={form}
        surfaces={[ANNOUNCEMENT_SURFACES.CANDIDATE]}
      />
    </Form>
  )
}

function PreviewHarness() {
  const [form] = Form.useForm()
  return (
    <Form
      form={form}
      initialValues={{
        animation: 'slide',
        display_seconds: 6,
        kind: 'maintenance',
        message_vi: 'Hệ thống sẽ bảo trì lúc 22 giờ.',
        priority: 80,
        surfaces: [ANNOUNCEMENT_SURFACES.CANDIDATE],
      }}
    >
      <PreviewStep announcements={[]} form={form} />
    </Form>
  )
}

describe('AnnouncementEditor', () => {
  afterEach(() => vi.restoreAllMocks())

  it('previews content preserved from a previous editor step', () => {
    render(<PreviewHarness />)

    expect(screen.getByText('Hệ thống sẽ bảo trì lúc 22 giờ.')).toBeInTheDocument()
    expect(screen.queryByText('Nội dung thông báo sẽ xuất hiện tại đây.')).not.toBeInTheDocument()
    const previewStrip = screen.getByLabelText('Xem trước thông báo')
      .querySelector('.announcement-preview__strip')
    expect(previewStrip).toHaveClass('is-motion-slide')
    expect(previewStrip).toHaveStyle('--announcement-preview-motion-period: 6s')
  })

  it('connects both discoverable route selectors to the form store', () => {
    render(
      <Form
        initialValues={{
          auth_audiences: [ANNOUNCEMENT_AUDIENCES.GUEST],
          exclude_path_prefixes: [],
          include_path_prefixes: [],
          roles: [],
          surfaces: [ANNOUNCEMENT_SURFACES.CANDIDATE],
        }}
      >
        <TargetStep surfaces={[ANNOUNCEMENT_SURFACES.CANDIDATE]} />
      </Form>,
    )

    expect(screen.getByRole('combobox', {
      name: 'Chỉ hiển thị tại các nhóm trang',
    })).toHaveAttribute('id', 'include_path_prefixes')
    expect(screen.getByRole('combobox', {
      name: 'Không hiển thị tại các nhóm trang',
    })).toHaveAttribute('id', 'exclude_path_prefixes')
  })

  it('closes the route menu after a mobile selection so editor actions stay reachable', async () => {
    mockMobileViewport()
    const user = userEvent.setup()
    render(
      <Form
        initialValues={{
          auth_audiences: [ANNOUNCEMENT_AUDIENCES.GUEST],
          exclude_path_prefixes: [],
          include_path_prefixes: [],
          roles: [],
          surfaces: [ANNOUNCEMENT_SURFACES.CANDIDATE],
        }}
      >
        <TargetStep surfaces={[ANNOUNCEMENT_SURFACES.CANDIDATE]} />
      </Form>,
    )

    const routeSelect = screen.getByRole('combobox', {
      name: 'Chỉ hiển thị tại các nhóm trang',
    })
    await user.click(routeSelect)
    expect(routeSelect).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByText('Danh sách việc làm · Công khai — /viec-lam'))

    await waitFor(() => {
      expect(routeSelect).toHaveAttribute('aria-expanded', 'false')
      expect(routeSelect).not.toHaveFocus()
    })
  })

  it('warns when a guest-facing cross-portal CTA requires login', async () => {
    render(<CtaFieldsHarness ctaUrl="/tuyendung/app/jobs/new" />)

    expect(await screen.findByText('Một phần người xem sẽ phải đăng nhập'))
      .toBeInTheDocument()
    expect(screen.getByText(/CTA sẽ mở sang cổng khác/)).toBeInTheDocument()
  })
})
