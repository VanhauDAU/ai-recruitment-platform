import { Outlet } from 'react-router'
import { BrandLogo } from '@/entities/site-settings'
import { OnboardingVoiceProvider } from '@/widgets/onboarding-interview'
import { legacyAsset } from '@/shared/config/assets'

const BG_IMAGE = legacyAsset('onboarding/bg-step-1.png')

/**
 * Provider giọng nói nằm ở layout chứ không phải trong page: AudioContext chỉ
 * mở được trong cử chỉ người dùng (nút "Bắt đầu thôi!" mở cuộc trò chuyện), mà
 * mỗi page unmount là player bị destroy.
 *
 * Layout cao đúng một màn hình và `min-h-0` xuống tận `main` để khung chat tự
 * cuộn bên trong thay vì đẩy cả trang dài ra.
 */
export default function OnboardingLayout() {
  return (
    <OnboardingVoiceProvider>
      <div
        className="flex h-[100dvh] flex-col text-slate-900"
        style={{
          backgroundImage: `url(${BG_IMAGE})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundColor: '#1d7a4f',
        }}
      >
        <header className="flex h-14 shrink-0 items-center bg-white/95 px-6 shadow-sm backdrop-blur-sm">
          <div className="mx-auto flex items-center gap-3">
            <BrandLogo imageClassName="h-8 max-w-[160px]" />
            <span className="hidden h-5 w-px bg-slate-300 sm:block" />
            <span className="hidden text-sm text-slate-500 sm:block">Tiếp lợi thế, nối thành công</span>
          </div>
        </header>
        <main className="flex min-h-0 flex-1 flex-col">
          <Outlet />
        </main>
      </div>
    </OnboardingVoiceProvider>
  )
}
