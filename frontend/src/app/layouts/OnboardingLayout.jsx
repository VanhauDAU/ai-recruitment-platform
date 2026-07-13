import { Outlet } from 'react-router-dom'
import { BrandLogo } from '@/entities/site-settings'

const BG_IMAGE = 'https://static.topcv.vn/v4/image/onboard-user/bg-step-1.png'

export default function OnboardingLayout() {
  return (
    <div
      className="flex min-h-[100dvh] flex-col text-slate-900"
      style={{
        backgroundImage: `url(${BG_IMAGE})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#1d7a4f',
      }}
    >
      <header className="flex h-14 shrink-0 items-center bg-white/95 px-6 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-3  mx-auto">
          <BrandLogo imageClassName="h-8 max-w-[160px]" />
          <span className="hidden h-5 w-px bg-slate-300 sm:block" />
          <span className="hidden text-sm text-slate-500 sm:block">Tiếp lợi thế, nối thành công</span>
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  )
}
