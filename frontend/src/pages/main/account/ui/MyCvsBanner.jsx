import { CloudUploadOutlined, FileAddOutlined } from '@ant-design/icons'

// Banner quảng bá đầu trang Quản lý CV — thuần trình bày.
export default function MyCvsBanner({ onCreateCv, onUploadCv }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0d5c3a] to-[#137a4e] p-6 text-white shadow-md">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:items-center">
        <div className="md:col-span-8 space-y-4">
          <h2 className="text-xl font-bold leading-snug sm:text-2xl">
            Ứng viên được NTD chủ động tiếp cận{' '}
            <span className="text-[#00ff66] font-extrabold underline decoration-2 underline-offset-4">
              tăng 23%
            </span>{' '}
            trong tuần vừa rồi
          </h2>
          <p className="text-sm text-emerald-100 font-medium">
            Cập nhật CV để không bỏ lỡ cơ hội!
          </p>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              type="button"
              onClick={onCreateCv}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2.5 text-xs font-bold text-[#0d5c3a] transition-all hover:bg-slate-50 cursor-pointer shadow-sm"
            >
              <FileAddOutlined />
              Tạo CV online +
            </button>
            <button
              type="button"
              onClick={onUploadCv}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800/80 border border-emerald-700 px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-emerald-950 cursor-pointer"
            >
              <CloudUploadOutlined />
              Tải CV lên
            </button>
          </div>
        </div>

        {/* Cột phải: SVG Biểu đồ tăng trưởng sinh động */}
        <div className="hidden md:col-span-4 md:flex md:justify-end">
          <div className="relative h-24 w-44">
            {/* Chỉ số tăng trưởng */}
            <div className="absolute left-2 top-0 flex items-center gap-1 text-xs font-bold text-[#00ff66]">
              <span className="animate-pulse">↗</span> 23%
            </div>
            <svg className="h-full w-full overflow-visible" viewBox="0 0 160 80">
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00ff66" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#00ff66" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Đường lưới phụ */}
              <line x1="0" y1="70" x2="160" y2="70" stroke="rgba(255,255,255,0.08)" strokeDasharray="3,3" />
              <line x1="0" y1="40" x2="160" y2="40" stroke="rgba(255,255,255,0.08)" strokeDasharray="3,3" />
              {/* Vùng gradient phủ dưới đồ thị */}
              <path
                d="M 10 60 Q 45 35, 80 50 T 150 15 L 150 75 L 10 75 Z"
                fill="url(#chartGrad)"
              />
              {/* Đường vẽ chính */}
              <path
                d="M 10 60 Q 45 35, 80 50 T 150 15"
                fill="none"
                stroke="#00ff66"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Điểm nhấn & Ripple */}
              <circle cx="150" cy="15" r="4.5" fill="#00ff66" />
              <circle cx="150" cy="15" r="10" fill="none" stroke="#00ff66" strokeWidth="1.5" className="animate-ping opacity-60" style={{ transformOrigin: '150px 15px' }} />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
