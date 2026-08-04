import { ArrowRightOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useNavigate } from 'react-router'
import { useSession } from '@/entities/session'
import { InterviewMascot, useOnboardingVoice, welcomeBubble } from '@/widgets/onboarding-interview'

const BENEFITS = [
  { icon: '✦', text: 'Trải nghiệm tìm việc cá nhân hoá' },
  { icon: '✦', text: 'Gợi ý công việc phù hợp' },
  { icon: '✦', text: 'Hỗ trợ bởi AI' },
]

export default function OnboardUser() {
  const { user } = useSession()
  const { unlock } = useOnboardingVoice()
  const navigate = useNavigate()

  // Cử chỉ duy nhất trong cả luồng để mở Web Audio. Provider ở layout nên
  // context vẫn sống sau khi chuyển sang màn phỏng vấn và robot nói được ngay.
  function start() {
    unlock()
    navigate('/onboard-user-setting')
  }

  return (
    <section className="flex flex-1 flex-col items-center gap-8 px-6 py-10 sm:px-14 lg:flex-row lg:gap-4 lg:px-20 lg:py-12 xl:px-28">
      <div className="flex w-full flex-col justify-center lg:w-1/2">
        <h1 className="text-2xl font-bold leading-snug text-white sm:text-3xl xl:text-4xl">
          Chào mừng bạn đến với ProCV,
          <br />
          <span className="text-[#a8f5c8]">{user?.full_name?.trim() || 'bạn'}</span>
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
            iconPlacement="end"
            onClick={start}
            className="!h-10 !rounded-full !border-emerald-400 !bg-emerald-500 !px-8 !font-semibold hover:!bg-emerald-400"
          >
            Bắt đầu
          </Button>
        </div>
      </div>

      <div className="w-full lg:w-1/2">
        {/* Chưa có cử chỉ nào nên chưa đọc được; bong bóng chạy typewriter. */}
        <InterviewMascot
          autoSpeak={false}
          emotion="happy"
          float
          pose="wave"
          speech={welcomeBubble(user)}
          speechId="welcome"
        />
      </div>
    </section>
  )
}
