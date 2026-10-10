import { ArrowRightOutlined, EditOutlined, FileTextOutlined, RobotOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { ProcvMascot } from '@/shared/ui/mascot'

const MODES = [
  {
    key: 'manual',
    icon: <EditOutlined aria-hidden="true" />,
    title: 'Nhập thủ công',
    description: 'Mở form chuẩn và tự hoàn thiện toàn bộ nội dung tin tuyển dụng.',
    action: 'Mở form',
  },
  {
    key: 'ai_brief',
    icon: <RobotOutlined aria-hidden="true" />,
    title: 'Tạo nhanh từ brief',
    description: 'Trả lời vài câu hỏi có hướng dẫn để AI viết bản nháp tiếng Việt.',
    action: 'Tạo với AI',
    recommended: true,
  },
  {
    key: 'jd_text',
    icon: <FileTextOutlined aria-hidden="true" />,
    title: 'Chuẩn hóa JD có sẵn',
    description: 'Dán nội dung cũ để AI chuyển thành cấu trúc của hệ thống.',
    action: 'Dán nội dung JD',
  },
]

export default function JobCreationModeChooser({ onChoose }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="job-creation-mode-title">
      <div className="grid min-w-0 gap-5 bg-gradient-to-br from-emerald-50 to-white p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-center">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Tin tuyển dụng mới</p>
          <h1 id="job-creation-mode-title" className="mt-2 break-words text-2xl font-bold text-slate-900 sm:text-3xl">
            Bạn muốn bắt đầu theo cách nào?
          </h1>
          <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-slate-600 sm:text-base">
            Dù chọn AI hay nhập thủ công, bạn luôn là người kiểm tra và quyết định lưu hoặc gửi duyệt tin.
          </p>
        </div>
        <div className="hidden justify-center lg:flex" aria-hidden="true">
          <ProcvMascot blink emotion="happy" float pose="wave" shadow="ground" size={150} />
        </div>
      </div>

      <div className="grid min-w-0 gap-4 p-4 sm:p-6 lg:grid-cols-3">
        {MODES.map((mode) => (
          <article
            key={mode.key}
            className={`relative flex min-w-0 flex-col rounded-xl border p-4 transition-colors sm:p-5 ${mode.recommended
              ? 'border-emerald-300 bg-emerald-50/50'
              : 'border-slate-200 bg-white hover:border-emerald-200'
            }`}
          >
            {mode.recommended && (
              <span className="absolute right-3 top-3 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                Đề xuất
              </span>
            )}
            <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-lg text-emerald-700">
              {mode.icon}
            </span>
            <h2 className="break-words text-lg font-bold text-slate-800">{mode.title}</h2>
            <p className="mt-2 flex-1 break-words text-sm leading-6 text-slate-600">{mode.description}</p>
            <Button
              className="mt-5 !w-full"
              type={mode.recommended ? 'primary' : 'default'}
              iconPlacement="end"
              icon={<ArrowRightOutlined />}
              onClick={() => onChoose(mode.key)}
            >
              {mode.action}
            </Button>
          </article>
        ))}
      </div>
    </section>
  )
}
