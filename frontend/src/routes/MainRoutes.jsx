import { lazy } from 'react'
import { Navigate, Route } from 'react-router-dom'
import { employerAppPath } from '../config/portals'
import AuthLayout from '../layouts/AuthLayout'
import MainLayout from '../layouts/MainLayout'

const Home = lazy(() => import('../pages/main/Home'))
const JobList = lazy(() => import('../pages/main/jobs/JobList'))
const JobDetail = lazy(() => import('../pages/main/jobs/JobDetail'))
const Login = lazy(() => import('../pages/main/auth/Login'))
const Register = lazy(() => import('../pages/main/auth/Register'))
const VerifyEmail = lazy(() => import('../pages/main/account/VerifyEmail'))

// Route cổng main (ứng viên + khách). Xem thêm EmployerRoutes / AdminRoutes.
export function mainRoutes() {
  return [
    <Route key="main" element={<MainLayout />}>
      <Route path="/" element={<Home />} />
      <Route path="/viec-lam" element={<JobList />} />
      <Route path="/viec-lam/tai/:locationSlug" element={<JobList />} />
      <Route path="/viec-lam/:slug" element={<JobDetail />} />
      <Route path="/jobs" element={<JobList />} />
      <Route path="/jobs/:slug" element={<JobDetail />} />
      <Route path="/tai-khoan/xac-thuc-email" element={<VerifyEmail />} />
    </Route>,

    <Route key="auth" element={<AuthLayout />}>
      <Route path="/login" element={<Login />} />
      <Route path="/sign-up" element={<Register />} />
      <Route path="/register" element={<Register />} />
    </Route>,

    <Route key="employer-redirect" path="/employer/dashboard" element={<Navigate to={employerAppPath('/dashboard')} replace />} />,
  ]
}

export default mainRoutes
