import { Outlet } from 'react-router-dom'
import PopularSearches from '../pages/main/components/layout/PopularSearches'
import Footer from '../components/layout/Footer'
import Header from '../components/layout/Header'

export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <PopularSearches />
      <Footer />
    </div>
  )
}
