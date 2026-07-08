import { Spin } from 'antd'
import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
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
const EmployerDashboard = lazy(() => import('../pages/employer/Dashboard'))
const AdminDashboard = lazy(() => import('../pages/admin/Dashboard'))
const NotFound = lazy(() => import('../pages/NotFound'))

function RouteFallback() {
  return (
    <div className="flex justify-center py-20">
      <Spin size="large" />
    </div>
  )
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
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

        <Route element={<ProtectedRoute allowedRoles={['employer']} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/employer/dashboard" element={<EmployerDashboard />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
