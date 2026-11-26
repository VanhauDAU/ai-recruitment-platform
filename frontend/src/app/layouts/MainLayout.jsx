import { Outlet, useLocation } from 'react-router'
import { EmailVerificationBanner, LoginPromptProvider } from '@/features/common/account/auth'
import { SavedJobsProvider } from '@/features/main/job/saved-jobs'
import { JobComparisonDock, JobComparisonProvider } from '@/features/main/job/compare-jobs'
import { CampaignRefCapture } from '@/features/main/job/track-campaign-ref'
import { FeedbackLauncher } from '@/features/main/account/submit-feedback'
import { ANNOUNCEMENT_SURFACES } from '@/entities/content/announcement'
import { AnnouncementStrip } from '@/widgets/common/announcement-strip'
import { FloatingActions } from '@/widgets/main/floating-actions'
import { Footer } from '@/widgets/main/footer'
import { JobPreferencesReminder } from '@/widgets/main/job-preferences-reminder'
import { Header, MobileTabBar } from '@/widgets/main/header'
import { PopularSearches } from '@/widgets/main/popular-searches'

export default function MainLayout() {
  const { pathname } = useLocation()
  // Trình soạn CV dùng layout toàn màn hình; trang "đã lưu" vẫn có header/footer thường.
  const isCvRoute = /^\/cv\/[^/]+\/chinh-sua\/?$/.test(pathname)
  // Trang xem CV (chủ sở hữu và link chia sẻ) tự có thanh thao tác toàn màn hình.
  const isCvViewer = /^\/cv\/[^/]+\/xem\/?$/.test(pathname) || pathname.startsWith('/cv/chia-se/')

  if (isCvViewer) return <Outlet />

  if (isCvRoute) {
    return (
      <JobComparisonProvider>
        <SavedJobsProvider>
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
              <FeedbackLauncher placement="editor" />
            </div>
          </LoginPromptProvider>
        </SavedJobsProvider>
      </JobComparisonProvider>
    )
  }

  return (
    <JobComparisonProvider>
      <SavedJobsProvider>
        <CampaignRefCapture />
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
            <FeedbackLauncher />
            <MobileTabBar />
          </div>
        </LoginPromptProvider>
      </SavedJobsProvider>
    </JobComparisonProvider>
  )
}
