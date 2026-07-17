import { Outlet, useLocation } from 'react-router-dom'
import { EmailVerificationBanner, LoginPromptProvider } from '@/features/auth'
import { SavedJobsProvider } from '@/features/saved-jobs'
import { FloatingActions } from '@/widgets/floating-actions'
import { Footer } from '@/widgets/main-footer'
import { JobPreferencesReminder } from '@/widgets/job-preferences-reminder'
import { Header } from '@/widgets/main-header'
import { PopularSearches } from '@/widgets/popular-searches'

export default function MainLayout() {
  const { pathname } = useLocation()
  const isCvRoute = pathname.startsWith('/cvs/') || pathname.startsWith('/cv/')

  if (isCvRoute) {
    return (
      <SavedJobsProvider>
        <LoginPromptProvider>
          <div className="flex h-dvh flex-col overflow-hidden bg-gray-50">
            <Header editorMode />
            <main className="min-h-0 flex-1">
              <Outlet />
            </main>
          </div>
        </LoginPromptProvider>
      </SavedJobsProvider>
    )
  }

  return (
    <SavedJobsProvider>
      <LoginPromptProvider>
        <div className="min-h-screen flex flex-col bg-gray-50">
          <Header />
          <EmailVerificationBanner verificationPath="/tai-khoan/xac-thuc-email" />
          <JobPreferencesReminder />
          {/* min-h-screen giữ footer + PopularSearches luôn nằm dưới fold, kể cả khi
              nội dung async chưa về — tránh footer bị đẩy xuống gây layout shift (CLS). */}
          <main className="flex-1 min-h-screen">
            <Outlet />
          </main>
          <PopularSearches />
          <Footer />
          <FloatingActions />
        </div>
      </LoginPromptProvider>
    </SavedJobsProvider>
  )
}
