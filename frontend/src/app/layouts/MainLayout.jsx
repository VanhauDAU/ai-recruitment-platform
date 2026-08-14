import { Outlet, useLocation } from 'react-router'
import { EmailVerificationBanner, LoginPromptProvider } from '@/features/auth'
import { SavedJobsProvider } from '@/features/saved-jobs'
import { JobComparisonDock, JobComparisonProvider } from '@/features/compare-jobs'
import { ANNOUNCEMENT_SURFACES } from '@/entities/announcement'
import { JobListRankingSync } from '@/entities/job'
import { AnnouncementStrip } from '@/widgets/announcement-strip'
import { CandidateAssistant } from '@/widgets/candidate-assistant'
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
      <JobComparisonProvider>
        <SavedJobsProvider>
          <JobListRankingSync />
          <LoginPromptProvider>
            <div className="flex h-dvh flex-col overflow-hidden bg-gray-50">
              <Header editorMode />
              <AnnouncementStrip
                surface={ANNOUNCEMENT_SURFACES.CANDIDATE}
                path={pathname}
                verificationPath="/tai-khoan/xac-thuc-email"
                stickyOffset="4rem"
              />
              <main className="min-h-0 flex-1">
                <Outlet />
              </main>
            </div>
          </LoginPromptProvider>
        </SavedJobsProvider>
      </JobComparisonProvider>
    )
  }

  return (
    <JobComparisonProvider>
      <SavedJobsProvider>
        <JobListRankingSync />
        <LoginPromptProvider>
          <div className="min-h-screen flex flex-col bg-gray-50">
            <Header />
            <AnnouncementStrip
              surface={ANNOUNCEMENT_SURFACES.CANDIDATE}
              path={pathname}
              verificationPath="/tai-khoan/xac-thuc-email"
              stickyOffset="4rem"
              legacy={(
                <>
                  <EmailVerificationBanner verificationPath="/tai-khoan/xac-thuc-email" />
                  <JobPreferencesReminder />
                </>
              )}
            />
            {/* min-h-screen giữ footer + PopularSearches luôn nằm dưới fold, kể cả khi
                nội dung async chưa về — tránh footer bị đẩy xuống gây layout shift (CLS). */}
            <main className="flex-1 min-h-screen">
              <Outlet />
            </main>
            <PopularSearches />
            <Footer />
            <JobComparisonDock />
            <FloatingActions />
            <CandidateAssistant />
          </div>
        </LoginPromptProvider>
      </SavedJobsProvider>
    </JobComparisonProvider>
  )
}
