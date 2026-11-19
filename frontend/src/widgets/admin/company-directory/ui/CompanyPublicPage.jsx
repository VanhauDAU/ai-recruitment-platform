import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Form, Input, Modal, Tag } from 'antd'
import { Suspense, useState } from 'react'
import {
  adminCompanyKeys,
  getAdminCompanyPublicPage,
  setAdminCompanyContentReview,
  setAdminCompanyPolicyHold,
} from '@/entities/company/admin-company'
import { CompanyProfileView } from '@/entities/company/company'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { MAIN_PORTAL_URL } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import { CompanyPanel } from './CompanyPanel'
import { getIntlLocale } from '@/shared/config/i18n'

const REASON_MIN_LENGTH = 10
const REASON_MAX_LENGTH = 500
const ACTION_COPY = {
  apply: {
    title: 'Tạm ẩn trang công ty',
    confirm: 'Tạm ẩn trang',
    reasonLabel: 'Lý do tạm ẩn',
    success: 'Đã tạm ẩn trang công ty khỏi các bề mặt công khai.',
  },
  release: {
    title: 'Khôi phục trang công ty',
    confirm: 'Khôi phục hiển thị',
    reasonLabel: 'Lý do khôi phục',
    success: 'Đã khôi phục hiển thị trang công ty.',
  },
  require: {
    title: 'Bật duyệt trước nội dung',
    confirm: 'Bật duyệt trước',
    reasonLabel: 'Lý do bật duyệt trước',
    success: 'Từ giờ nội dung trang của công ty phải chờ duyệt trước khi lên trang.',
  },
  release_review: {
    title: 'Tắt duyệt trước nội dung',
    confirm: 'Tắt duyệt trước',
    reasonLabel: 'Lý do tắt duyệt trước',
    success: 'Nội dung trang của công ty lại được đăng ngay và hậu kiểm.',
  },
}
const ACTION_DESCRIPTIONS = {
  apply: (name) => `Trang của ${name} sẽ trả 404 và bị loại khỏi danh bạ, gợi ý và sitemap cho tới khi được khôi phục.`,
  release: (name) => `Trang của ${name} sẽ hiển thị lại trên các bề mặt công khai.`,
  require: (name) => `Mỗi lần ${name} sửa nội dung trang sẽ thành yêu cầu cập nhật chờ quản trị viên duyệt.`,
  release_review: (name) => `${name} sửa nội dung trang sẽ lên trang ngay; quản trị viên xem lại ở mục Thay đổi nội dung.`,
}

function saveAction(publicId, action, reason) {
  if (action === 'require') return setAdminCompanyContentReview(publicId, { action: 'require', reason })
  if (action === 'release_review') return setAdminCompanyContentReview(publicId, { action: 'release', reason })
  return setAdminCompanyPolicyHold(publicId, { action, reason })
}
// Dữ liệu việc làm và công ty tương tự thuộc trang công khai; bản xem trước chỉ đánh dấu vị trí.
const PREVIEW_SLOTS = {
  jobs: <p className="text-sm text-slate-500">Danh sách việc làm đang tuyển hiển thị tại đây trên trang công khai.</p>,
  similar_companies: <p className="text-sm text-slate-500">Công ty cùng lĩnh vực được gợi ý trên trang công khai.</p>,
}

function validateReason(_, value) {
  return (value || '').trim().length >= REASON_MIN_LENGTH
    ? Promise.resolve()
    : Promise.reject(new Error(`Nhập lý do từ ${REASON_MIN_LENGTH} đến ${REASON_MAX_LENGTH} ký tự.`))
}

function formatHoldTime(value) {
  return value
    ? new Date(value).toLocaleString(getIntlLocale(), { dateStyle: 'medium', timeStyle: 'short' })
    : ''
}

export default function CompanyPublicPage({ company, enabled }) {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  // Giữ `action` khi đóng để tiêu đề và nút không đổi chữ trong lúc modal đang khép.
  const [dialog, setDialog] = useState({ action: 'apply', open: false })
  const { action } = dialog
  const copy = ACTION_COPY[action]
  const closeDialog = () => setDialog((current) => ({ ...current, open: false }))
  const queryKey = adminCompanyKeys.publicPage(company.public_id)
  const pageQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => getAdminCompanyPublicPage(company.public_id, { signal }),
    enabled,
  })
  const mutation = useMutation({
    mutationFn: (reason) => saveAction(company.public_id, action, reason),
    onSuccess: (page) => {
      queryClient.setQueryData(queryKey, page)
      message.success(copy.success)
      closeDialog()
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, 'Không thể cập nhật trạng thái trang công ty.'))
    },
  })

  async function submit() {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    mutation.mutate(values.reason.trim())
  }

  if (pageQuery.isError) {
    return (
      <Alert
        showIcon
        type="error"
        title={getApiErrorMessage(pageQuery.error, 'Không thể tải trang công khai của công ty.')}
        action={<Button size="small" onClick={() => pageQuery.refetch()}>Thử lại</Button>}
      />
    )
  }
  if (!pageQuery.data) {
    return (
      <CompanyPanel title="Trang công khai">
        <div className="h-40 animate-pulse rounded-xl bg-slate-100" aria-label="Đang tải trang công khai" />
      </CompanyPanel>
    )
  }

  const page = pageQuery.data
  const hold = page.policy_hold

  return (
    <CompanyPanel
      title="Trang công khai"
      description="Bản xem trước dùng đúng nội dung ứng viên nhìn thấy trên trang công ty."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Tag color={hold.active ? 'red' : 'green'}>{hold.active ? 'Đang tạm ẩn' : 'Đang hiển thị'}</Tag>
          <Tag color={page.is_indexable ? 'blue' : 'default'}>
            {page.is_indexable ? 'Được index' : 'Không index'}
          </Tag>
          {!hold.active && (
            <a
              href={`${MAIN_PORTAL_URL.replace(/\/$/, '')}${page.public_path}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold !text-emerald-700"
            >
              Mở trang công khai
            </a>
          )}
        </div>
        <Button
          danger={!hold.active}
          onClick={() => setDialog({ action: hold.active ? 'release' : 'apply', open: true })}
        >
          {hold.active ? 'Khôi phục hiển thị' : 'Tạm ẩn trang'}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Tag color={page.content_review_required ? 'orange' : 'default'}>
          {page.content_review_required ? 'Nội dung: duyệt trước' : 'Nội dung: đăng ngay, hậu kiểm'}
        </Tag>
        <Button onClick={() => setDialog({ action: page.content_review_required ? 'release_review' : 'require', open: true })}>
          {page.content_review_required ? 'Tắt duyệt trước' : 'Bật duyệt trước'}
        </Button>
      </div>

      {hold.active && (
        <Alert
          className="mt-3"
          showIcon
          type="warning"
          title={`Trang trả 404 từ ${formatHoldTime(hold.at)}${hold.actor_name ? `, tạm ẩn bởi ${hold.actor_name}` : ''}. Lý do: ${hold.reason}`}
        />
      )}

      <div className="company-directory__public-preview">
        <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-slate-100" />}>
          <CompanyProfileView profile={page.profile} slots={PREVIEW_SLOTS} preview />
        </Suspense>
      </div>

      <Modal
        cancelText="Hủy"
        confirmLoading={mutation.isPending}
        destroyOnHidden
        okButtonProps={{ danger: action === 'apply' || action === 'require' }}
        okText={copy.confirm}
        onCancel={() => {
          if (!mutation.isPending) closeDialog()
        }}
        onOk={submit}
        open={dialog.open}
        title={copy.title}
      >
        <p className="mb-4 text-sm text-slate-500">{ACTION_DESCRIPTIONS[action](company.company_name)}</p>
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item label={copy.reasonLabel} name="reason" rules={[{ required: true, validator: validateReason }]}>
            <Input.TextArea autoFocus maxLength={REASON_MAX_LENGTH} rows={4} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </CompanyPanel>
  )
}
