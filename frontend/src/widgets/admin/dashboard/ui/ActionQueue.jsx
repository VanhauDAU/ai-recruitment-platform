import {
  CheckCircleFilled,
  ClockCircleOutlined,
  ExclamationCircleFilled,
  RightOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router'
import { formatElapsed } from '@/shared/lib/date-time'
import { formatNumber } from '../model/dashboard-model'

function QueueRow({ item, now }) {
  const meter = Math.min(item.slaUsed, 1) * 100
  return (
    <li>
      <Link to={item.to} className={`admin-home-queue__row admin-home-queue__row--${item.tone}`}>
        <span className="admin-home-queue__main">
          <span className="admin-home-queue__label">{item.label}</span>
          <span className="admin-home-queue__hint">{item.hint}</span>
        </span>
        <span className="admin-home-queue__count" aria-label={`${item.count} mục`}>
          {formatNumber(item.count)}
        </span>
        <span className="admin-home-queue__age">
          <span className="admin-home-queue__age-text">
            {item.overdue > 0
              ? <><ExclamationCircleFilled aria-hidden="true" /> {formatNumber(item.overdue)} quá hạn</>
              : <><ClockCircleOutlined aria-hidden="true" /> {item.oldest_at ? `Chờ lâu nhất ${formatElapsed(item.oldest_at, now)}` : 'Vừa gửi'}</>}
          </span>
          <span
            className="admin-home-queue__meter"
            role="meter"
            aria-label={`Đã dùng ${Math.round(meter)}% thời hạn xử lý ${item.sla_hours} giờ`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(meter)}
          >
            <span style={{ width: `${Math.max(meter, 4)}%` }} />
          </span>
          <span className="admin-home-queue__sla">Hạn xử lý {item.sla_hours} giờ</span>
        </span>
        <RightOutlined className="admin-home-queue__chevron" aria-hidden="true" />
      </Link>
    </li>
  )
}

export default function ActionQueue({ queue, now }) {
  const { pending, cleared, total, overdue } = queue
  return (
    <section className="admin-home-queue" aria-labelledby="admin-home-queue-title">
      <header className="admin-home-queue__header">
        <div>
          <h2 id="admin-home-queue-title" className="admin-home__section-title">Cần xử lý</h2>
          <p className="admin-home__section-note">
            {total > 0
              ? `${formatNumber(total)} mục đang chờ, việc gấp nhất xếp trên cùng`
              : 'Không có hồ sơ, báo cáo hay nội dung nào đang chờ duyệt'}
          </p>
        </div>
        {overdue > 0 && (
          <span className="admin-home-queue__overdue">
            <ExclamationCircleFilled aria-hidden="true" /> {formatNumber(overdue)} quá hạn
          </span>
        )}
      </header>

      {pending.length > 0 ? (
        <ul className="admin-home-queue__list">
          {pending.map((item) => <QueueRow key={item.key} item={item} now={now} />)}
        </ul>
      ) : (
        <div className="admin-home-queue__empty">
          <CheckCircleFilled aria-hidden="true" />
          <p>Đã xử lý hết. Hàng chờ mới sẽ hiện ở đây ngay khi có hồ sơ hoặc báo cáo gửi đến.</p>
        </div>
      )}

      {pending.length > 0 && cleared.length > 0 && (
        <p className="admin-home-queue__cleared">
          <CheckCircleFilled aria-hidden="true" />
          <span>Đã xử lý hết: {cleared.map((item) => item.label).join(', ')}</span>
        </p>
      )}
    </section>
  )
}
