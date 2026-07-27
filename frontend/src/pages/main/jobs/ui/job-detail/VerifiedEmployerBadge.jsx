import { CheckCircleFilled } from '@ant-design/icons'
import { Tooltip } from 'antd'

/**
 * Dấu tick "đã xác thực" đặt cạnh tiêu đề tin, kèm danh sách điều kiện.
 *
 * Chỉ hiện khi nhà tuyển dụng đạt đủ mọi điều kiện — hiện dấu mờ cho hồ sơ chưa
 * đạt sẽ khiến tin thường trông như bị đánh dấu xấu. Nhãn điều kiện do backend
 * trả về vì ngưỡng tuổi tài khoản là cấu hình admin, không cố định ở frontend.
 */
export default function VerifiedEmployerBadge({ verification, verified }) {
  const isVerified = verification ? verification.verified : Boolean(verified)
  if (!isVerified) return null

  const criteria = verification?.criteria || []
  const icon = <CheckCircleFilled className="text-[15px] text-[#00b14f]" />
  if (criteria.length === 0) return icon

  return (
    <Tooltip
      placement="bottom"
      color="#1f2733"
      trigger={['hover', 'focus', 'click']}
      styles={{ root: { maxWidth: 'min(340px, calc(100vw - 32px))' } }}
      title={(
        <div className="py-0.5">
          <p className="mb-2 text-[13px] leading-5">
            <strong>Nhà tuyển dụng</strong> đã được xác thực:
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
      )}
    >
      <button
        type="button"
        className="-m-2 inline-flex min-h-8 min-w-8 shrink-0 cursor-help items-center justify-center rounded-full text-[#00b14f] align-middle outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
        aria-label="Nhà tuyển dụng đã được xác thực, xem 5 tiêu chí"
      >
        {icon}
      </button>
    </Tooltip>
  )
}
