import { BellOutlined, PlusOutlined } from '@ant-design/icons'
import { Button } from 'antd'

export default function JobAlertEmptyState({ createBlocked, onCreate }) {
  return (
    <div className="rounded-2xl border border-dashed border-emerald-300 bg-gradient-to-br from-emerald-50 to-white px-5 py-10 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-2xl text-emerald-600 shadow-sm"><BellOutlined /></span>
      <h2 className="mt-4 text-base font-bold text-slate-900">Chưa có thông báo việc làm</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
        Tạo bộ tiêu chí đầu tiên để không bỏ lỡ những cơ hội mới phù hợp.
      </p>
      <Button
        type="primary"
        aria-label="Tạo thông báo việc làm mới"
        icon={<PlusOutlined />}
        disabled={createBlocked}
        onClick={onCreate}
        className="mt-5 !rounded-full"
      >
        Tạo thông báo việc làm mới
      </Button>
    </div>
  )
}

