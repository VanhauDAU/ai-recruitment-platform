import { ArrowRightOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useSession } from '@/entities/session'

const BENEFITS = [
  { icon: '✦', text: 'Trải nghiệm tìm việc cá nhân hoá' },
  { icon: '✦', text: 'Gợi ý công việc phù hợp' },
  { icon: '✦', text: 'Hỗ trợ bởi AI' },
]

export default function OnboardUser() {
  const { user } = useSession()
  const navigate = useNavigate()
  const name = user?.full_name?.trim() || 'bạn'

  return (
    <section className="flex flex-1 items-center">
      {/* Left column – text content */}
      <div className="flex w-full flex-col justify-center px-8 py-12 sm:px-14 lg:w-1/2 lg:px-20 xl:px-28">
        <h1 className="text-2xl font-bold leading-snug text-white sm:text-3xl xl:text-4xl">
          Chào mừng bạn đến với ProCV,
          <br />
          <span className="text-[#a8f5c8]">{name}</span>
        </h1>

        <p className="mt-4 max-w-sm text-sm leading-6 text-white/80 sm:text-base">
          Hãy bắt đầu bằng cách cung cấp một số thông tin cơ bản để
          chúng tôi có thể giúp bạn:
        </p>

        <ul className="mt-5 space-y-2.5">
          {BENEFITS.map(({ icon, text }) => (
            <li key={text} className="flex items-center gap-2.5 text-sm text-white/90 sm:text-base">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-[10px] text-white">
                {icon}
              </span>
              {text}
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button
            size="large"
            onClick={() => navigate('/', { replace: true })}
            className="!h-10 !rounded-full !border-white/60 !bg-transparent !px-6 !font-medium !text-white hover:!border-white hover:!bg-white/10"
          >
            Tôi sẽ hoàn thiện sau
          </Button>
          <Button
            type="primary"
            size="large"
            icon={<ArrowRightOutlined />}
            iconPosition="end"
            onClick={() => navigate('/onboard-user-setting')}
            className="!h-10 !rounded-full !border-emerald-400 !bg-emerald-500 !px-8 !font-semibold hover:!bg-emerald-400"
          >
            Bắt đầu
          </Button>
        </div>
      </div>

      {/* Right column – decorative space (illustration comes from bg image) */}
      <div className="hidden lg:block lg:w-1/2" aria-hidden="true" />
    </section>
  )
}
