import { lazy } from 'react'
import { Navigate, Route } from 'react-router-dom'
import { employerAppPath } from '../config/portals'
import AuthLayout from '../layouts/AuthLayout'
import DashboardLayout from '../layouts/DashboardLayout'
import MainLayout from '../layouts/MainLayout'
import ProtectedRoute from './ProtectedRoute'

const Home = lazy(() => import('../pages/Home'))
const JobList = lazy(() => import('../pages/jobs/JobList'))
const JobDetail = lazy(() => import('../pages/jobs/JobDetail'))
const Login = lazy(() => import('../pages/auth/Login'))
const Register = lazy(() => import('../pages/auth/Register'))
const CandidateDashboard = lazy(() => import('../pages/candidate/Dashboard'))

export default function PublicRoutes() {
  return (
    <>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/viec-lam" element={<JobList />} />
        <Route path="/viec-lam/tai/:locationSlug" element={<JobList />} />
        <Route path="/viec-lam/:slug" element={<JobDetail />} />
        <Route path="/jobs" element={<JobList />} />
        <Route path="/jobs/:slug" element={<JobDetail />} />
      </Route>

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/sign-up" element={<Register />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['candidate']} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/candidate/dashboard" element={<CandidateDashboard />} />
        </Route>
      </Route>

      <Route path="/employer/dashboard" element={<Navigate to={employerAppPath('/dashboard')} replace />} />
    </>
  )
}
