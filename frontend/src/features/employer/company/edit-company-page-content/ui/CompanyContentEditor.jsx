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
import { getIntlLocale, m } from '@/shared/config/i18n'

const REQUEST_STATUS = {
  submitted: ['blue', m.employer_company_request_submitted()],
  in_review: ['gold', m.employer_company_request_in_review()],
  changes_requested: ['orange', m.employer_company_content_status_changes_requested()],
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
      message.success(m.employer_company_request_withdrawn())
      queryClient.invalidateQueries({ queryKey: employerCompanyPageKeys.page })
      queryClient.invalidateQueries({ queryKey: employerProfileKeys.companyUpdateRequests })
    },
  })
  const [color, label] = REQUEST_STATUS[request.status] || ['default', request.status]
  const submittedAt = formatDateTime(request.submitted_at)

  return (
    <div className="company-content-request" role="region" aria-label={m.employer_company_request_region()}>
      <Tag color={color}>{label}</Tag>
      <span className="company-content-hint">
        {submittedAt ? `${m.employer_company_request_sent_at({ time: submittedAt })} ` : ''}
        {direct
          ? m.employer_company_request_direct_hint()
          : m.employer_company_request_review_hint()}
      </span>
      {canWithdraw && (
        <ConfirmAction
          danger
          title={m.employer_company_request_withdraw_title()}
          description={m.employer_company_request_withdraw_description()}
          confirmText={m.employer_company_request_withdraw()}
          onConfirm={() => withdraw.mutateAsync()}
          onConfirmError={(error) => message.error(getApiErrorMessage(error, m.employer_company_request_withdraw_failed()))}
        >
          <Button size="small" danger>{m.employer_company_request_withdraw()}</Button>
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
        ? <p className="company-content-hint">{m.employer_company_content_direct_hint()}</p>
        : <Alert showIcon type="warning" title={m.employer_company_content_review_mode()} />)}
      {request && <RequestBar request={request} direct={direct} canWithdraw={canEdit && !inReview} />}
      {lockedAny && (
        <Alert
          showIcon
          type="info"
          title={direct
            ? m.employer_company_content_locked_direct()
            : m.employer_company_content_locked_review()}
        />
      )}
      {!canEdit && (
        <p className="company-content-hint">
          {permissions.blockers?.[0]?.message || m.employer_company_content_read_only()}
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
