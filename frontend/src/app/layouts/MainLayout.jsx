import { Outlet, useLocation } from 'react-router-dom'
import { EmailVerificationBanner, LoginPromptProvider } from '@/features/auth'
import { SavedJobsProvider } from '@/features/saved-jobs'
import FloatingActions from '@/widgets/floating-actions/FloatingActions'
import Footer from '@/widgets/main-footer/Footer'
import { JobPreferencesReminder } from '@/widgets/job-preferences-reminder'
import Header from '@/widgets/main-header/Header'
import { PopularSearches } from '@/widgets/popular-searches'

export default function MainLayout() {
  const { pathname } = useLocation()
  const isCvRoute = pathname.startsWith('/cvs/')

  return (
    <SavedJobsProvider>
      <LoginPromptProvider>
        <div className="min-h-screen flex flex-col bg-gray-50">
          <Header />
          <EmailVerificationBanner verificationPath="/tai-khoan/xac-thuc-email" />
          {!isCvRoute && <JobPreferencesReminder />}
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
