import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Tag } from 'antd'
import { useEffect } from 'react'
import { employerCompanyPageKeys } from '@/entities/company/employer-company-page'
import { changeEmployerCompanyUpdateRequestLifecycle, employerProfileKeys } from '@/entities/account/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import ConfirmAction from '@/shared/ui/confirm-action/ConfirmAction'
import { isDirectPublish } from '../model/content-form'
import { BenefitsCard, OfficesCard } from './ListContentCards'
import { GalleryCard, HeroCard, RichTextCard, SocialLinksCard, VideoCard } from './TextContentCards'
import './edit-company-page-content.css'
import { getIntlLocale } from '@/shared/config/i18n'

const REQUEST_STATUS = {
  submitted: ['blue', 'Đã gửi, chờ duyệt'],
  in_review: ['gold', 'Đang thẩm định'],
  changes_requested: ['orange', 'Cần bổ sung'],
}

// Khối không còn khoá nào trong yêu cầu cập nhật.
const SETTLED_STATUSES = new Set(['published', 'empty'])

function formatDateTime(value) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleString(getIntlLocale(), { dateStyle: 'short', timeStyle: 'short' })
    : ''
}

function RequestBar({ request, canWithdraw, direct }) {
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
        {submittedAt ? `Gửi lúc ${submittedAt}. ` : ''}
        {direct
          ? 'Các khối gắn nhãn “Chờ duyệt” chỉ lên trang sau khi quản trị viên duyệt.'
          : 'Thay đổi chỉ lên trang công khai sau khi quản trị viên duyệt.'}
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
 * Tab "Nội dung": mỗi nhóm nội dung là một thẻ lưu riêng. Mặc định lưu là đăng
 * ngay và quản trị viên hậu kiểm; khi công ty bị bật duyệt trước, mỗi thẻ gộp
 * vào yêu cầu cập nhật đang mở. `focusCard` (`{ id }`) cuộn tới thẻ được chọn
 * từ thước đo hoàn thiện.
 */
export default function CompanyContentEditor({ page, focusCard }) {
  const { content_form: form, permissions } = page
  const request = form.request
  const direct = isDirectPublish(form)
  const inReview = request?.status === 'in_review' || request?.editable === false
  const canEdit = permissions.can_edit_content
  // Đăng ngay: chỉ khối còn nằm trong yêu cầu đang thẩm định bị khoá.
  const isLocked = (card) => !canEdit || (inReview && (!direct || !SETTLED_STATUSES.has(form.section_status?.[card])))
  const lockedAny = inReview && Object.keys(form.section_status || {}).some(isLocked)

  useEffect(() => {
    if (focusCard) document.getElementById(focusCard.id)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
  }, [focusCard])

  return (
    <div className="company-content-editor">
      {canEdit && (direct
        ? <p className="company-content-hint">Nội dung lưu xong hiển thị ngay trên trang công ty. Quản trị viên rà soát sau và có thể hoàn tác nội dung vi phạm quy định.</p>
        : <Alert showIcon type="warning" title="Quản trị viên đang bật duyệt trước: thay đổi chỉ lên trang công ty sau khi được duyệt." />)}
      {request && <RequestBar request={request} direct={direct} canWithdraw={canEdit && !inReview} />}
      {lockedAny && (
        <Alert
          showIcon
          type="info"
          title={direct
            ? 'Các khối "Chờ duyệt" đang được thẩm định nên tạm khoá cho tới khi quản trị viên xử lý xong.'
            : 'Đang được thẩm định. Nội dung tạm khoá cho tới khi quản trị viên xử lý xong.'}
        />
      )}
      {!canEdit && (
        <p className="company-content-hint">
          {permissions.blockers?.[0]?.message || 'Bạn chỉ có quyền xem nội dung trang công ty.'}
        </p>
      )}
      <HeroCard page={page} readOnly={isLocked('hero')} />
      <RichTextCard page={page} card="about" readOnly={isLocked('about')} />
      <BenefitsCard page={page} readOnly={isLocked('benefits')} />
      <RichTextCard page={page} card="culture" readOnly={isLocked('culture')} />
      <GalleryCard page={page} readOnly={isLocked('gallery')} />
      <VideoCard page={page} readOnly={isLocked('video')} />
      <SocialLinksCard page={page} readOnly={isLocked('social_links')} />
      <OfficesCard page={page} readOnly={isLocked('offices')} />
    </div>
  )
}
