import { CopyOutlined } from '@ant-design/icons'
import { Button } from 'antd'

export default function DomainClaimDnsValue({ label, value, onCopy }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="flex min-w-0 items-start gap-2 rounded-md border border-slate-200 bg-white p-2.5">
        <code className="min-w-0 flex-1 break-all text-xs leading-5 text-slate-800">{value}</code>
        <Button
          type="text"
          size="small"
          icon={<CopyOutlined />}
          aria-label={`Sao chép ${label.toLowerCase()}`}
          onClick={() => onCopy(value, label.toLowerCase())}
        />
      </div>
    </div>
  )
}
