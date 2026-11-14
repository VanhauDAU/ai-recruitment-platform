import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Tag } from 'antd'
import { useEffect } from 'react'
import { employerCompanyPageKeys } from '@/entities/employer-company-page'
import { changeEmployerCompanyUpdateRequestLifecycle, employerProfileKeys } from '@/entities/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import ConfirmAction from '@/shared/ui/ConfirmAction'
import { BenefitsCard, OfficesCard } from './ListContentCards'
import { GalleryCard, HeroCard, RichTextCard, SocialLinksCard, VideoCard } from './TextContentCards'
import './edit-company-page-content.css'

const REQUEST_STATUS = {
  submitted: ['blue', 'Đã gửi, chờ duyệt'],
  in_review: ['gold', 'Đang thẩm định'],
  changes_requested: ['orange', 'Cần bổ sung'],
}

function formatDateTime(value) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
    : ''
}

function RequestBar({ request, canWithdraw }) {
  const queryClient = useQueryClient()
  const withdraw = useMutation({
    // Hợp đồng workspace chưa trả `lock_version` của yêu cầu; gửi khi có.
    mutationFn: () => changeEmployerCompanyUpdateRequestLifecycle(
      request.public_id,
      'withdraw',
      request.lock_version === undefined ? {} : { lock_version: request.lock_version },
    ),
    onSuccess: () => {
      message.success('Đã rút yêu cầu cập nhật công ty.')
      queryClient.invalidateQueries({ queryKey: employerCompanyPageKeys.page })
      queryClient.invalidateQueries({ queryKey: employerProfileKeys.companyUpdateRequests })
    },
  })
  const [color, label] = REQUEST_STATUS[request.status] || ['default', request.status]
  const submittedAt = formatDateTime(request.submitted_at)

  return (
    <div className="company-content-request" role="region" aria-label="Yêu cầu cập nhật nội dung">
      <Tag color={color}>{label}</Tag>
      <span className="company-content-hint">
        {submittedAt ? `Gửi lúc ${submittedAt}. ` : ''}Thay đổi chỉ lên trang công khai sau khi quản trị viên duyệt.
      </span>
      {canWithdraw && (
        <ConfirmAction
          danger
          title="Rút yêu cầu cập nhật"
          description="Mọi thay đổi trong yêu cầu này, kể cả thông tin công ty gửi cùng, sẽ dừng xử lý."
          confirmText="Rút yêu cầu"
          onConfirm={() => withdraw.mutateAsync()}
          onConfirmError={(error) => message.error(getApiErrorMessage(error, 'Không thể rút yêu cầu cập nhật.'))}
        >
          <Button size="small" danger>Rút yêu cầu</Button>
        </ConfirmAction>
      )}
    </div>
  )
}

/**
 * Tab "Nội dung": mỗi nhóm nội dung là một thẻ gửi duyệt riêng, cùng gộp vào
 * yêu cầu cập nhật đang mở của người dùng. `focusCard` (`{ id }`) cuộn tới thẻ
 * được chọn từ thước đo hoàn thiện.
 */
export default function CompanyContentEditor({ page, focusCard }) {
  const { content_form: form, permissions } = page
  const request = form.request
  const inReview = request?.status === 'in_review' || request?.editable === false
  const readOnly = !permissions.can_edit_content || inReview

  useEffect(() => {
    if (focusCard) document.getElementById(focusCard.id)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
  }, [focusCard])

  return (
    <div className="company-content-editor">
      {request && <RequestBar request={request} canWithdraw={permissions.can_edit_content && !inReview} />}
      {inReview && (
        <Alert showIcon type="info" title="Đang được thẩm định. Nội dung tạm khoá cho tới khi quản trị viên xử lý xong." />
      )}
      {!permissions.can_edit_content && (
        <p className="company-content-hint">
          {permissions.blockers?.[0]?.message || 'Bạn chỉ có quyền xem nội dung trang công ty.'}
        </p>
      )}
      <HeroCard page={page} readOnly={readOnly} />
      <RichTextCard page={page} card="about" readOnly={readOnly} />
      <BenefitsCard page={page} readOnly={readOnly} />
      <RichTextCard page={page} card="culture" readOnly={readOnly} />
      <GalleryCard page={page} readOnly={readOnly} />
      <VideoCard page={page} readOnly={readOnly} />
      <SocialLinksCard page={page} readOnly={readOnly} />
      <OfficesCard page={page} readOnly={readOnly} />
    </div>
  )
}
