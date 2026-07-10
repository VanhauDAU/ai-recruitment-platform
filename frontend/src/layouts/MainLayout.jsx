import { Outlet } from 'react-router-dom'
import EmailVerificationBanner from '../components/auth/EmailVerificationBanner'
import Footer from '../components/layout/Footer'
import Header from '../components/layout/Header'
import PopularSearches from '../pages/main/components/layout/PopularSearches'

export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <EmailVerificationBanner verificationPath="/tai-khoan/xac-thuc-email" />
      <main className="flex-1">
        <Outlet />
      </main>
      <PopularSearches />
      <Footer />
    </div>
  )
}
