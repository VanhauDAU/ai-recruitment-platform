import { render, screen } from '@testing-library/react'
import { Form } from 'antd'
import { describe, expect, it } from 'vitest'
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_SURFACES,
} from '@/entities/announcement'
import AnnouncementCtaFields from './AnnouncementCtaFields'
import {
  PreviewStep,
  TargetStep,
} from './AnnouncementEditorSteps'

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
  it('previews content preserved from a previous editor step', () => {
    render(<PreviewHarness />)

    expect(screen.getByText('Hệ thống sẽ bảo trì lúc 22 giờ.')).toBeInTheDocument()
    expect(screen.queryByText('Nội dung thông báo sẽ xuất hiện tại đây.')).not.toBeInTheDocument()
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

  it('warns when a guest-facing cross-portal CTA requires login', async () => {
    render(<CtaFieldsHarness ctaUrl="/tuyendung/app/jobs/new" />)

    expect(await screen.findByText('Một phần người xem sẽ phải đăng nhập'))
      .toBeInTheDocument()
    expect(screen.getByText(/CTA sẽ mở sang cổng khác/)).toBeInTheDocument()
  })
})
