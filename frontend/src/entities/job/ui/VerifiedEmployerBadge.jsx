import { CheckCircleFilled } from '@ant-design/icons'
import { Tooltip } from 'antd'

function badgeTitle(criteria) {
  if (!criteria.length) return 'Nhà tuyển dụng đã xác thực'
  return (
    <div className="py-0.5">
      <p className="mb-2 text-[13px] leading-5">
        <strong>Nhà tuyển dụng</strong> đã đáp ứng đầy đủ:
      </p>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {criteria.map((item) => (
          <li key={item.key} className="flex items-start gap-2 text-xs leading-[18px]">
            <CheckCircleFilled className="mt-[3px] shrink-0 text-[#00b14f]" />
            <span className="min-w-0 break-words">{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Public trust badge for a job poster.
 *
 * List surfaces receive only `verified`; detail surfaces may opt into the
 * backend-owned criteria breakdown. An unverified badge is deliberately not
 * rendered so public pages never expose which private trust signal is missing.
 */
export default function VerifiedEmployerBadge({
  verification,
  verified,
  showCriteria = false,
  appearance = 'icon',
  className = '',
}) {
  const isVerified = verification?.verified ?? Boolean(verified)
  if (!isVerified) return null

  const criteria = showCriteria
    ? (verification?.criteria || []).filter((item) => item?.passed !== false)
    : []
  const hasCriteria = criteria.length > 0
  const ariaLabel = criteria.length
    ? `Nhà tuyển dụng đã xác thực, xem ${criteria.length} tiêu chí`
    : 'Nhà tuyển dụng đã xác thực'
  const label = appearance === 'label' ? 'NTD đã xác thực' : null

  return (
    <Tooltip
      placement="bottom"
      color="#1f2733"
      trigger={['hover', 'focus', 'click']}
      styles={{ root: { maxWidth: 'min(340px, calc(100vw - 32px))' } }}
      title={badgeTitle(criteria)}
    >
      <span
        role={hasCriteria ? 'button' : undefined}
        tabIndex={hasCriteria ? 0 : undefined}
        aria-label={ariaLabel}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full align-middle font-medium text-[#00b14f] outline-none ${hasCriteria ? 'cursor-help focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2' : ''} ${appearance === 'label' ? 'text-xs' : ''} ${className}`}
      >
        <CheckCircleFilled className="text-[15px] !text-[#00b14f]" />
        {label}
      </span>
    </Tooltip>
  )
}
