import { PlusOutlined } from '@ant-design/icons'
import { Button } from 'antd'

export default function JobAlertPageHeader({ createDisabled, limit, onCreate, usedCount }) {
  return (
    <header className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#063f32] via-[#087c55] to-[#0fba6b] px-5 py-6 text-white shadow-sm sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">Cơ hội dành cho bạn</p>
          <h1 className="mt-2 text-xl font-extrabold sm:text-2xl">Quản lý thông báo việc làm</h1>
          {Number.isInteger(usedCount) && Number.isInteger(limit) && (
            <p className="mt-2 text-sm font-medium text-emerald-50">
              Đã dùng {usedCount}/{limit} thông báo
            </p>
          )}
        </div>
        <Button
          aria-label="Tạo thông báo việc làm mới"
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          disabled={createDisabled}
          onClick={onCreate}
          className="!h-11 !w-full !shrink-0 !rounded-full !border-white !bg-white !px-5 !font-bold !text-emerald-700 hover:!bg-emerald-50 sm:!w-auto"
        >
          Tạo thông báo việc làm mới
        </Button>
      </div>
    </header>
  )
}
