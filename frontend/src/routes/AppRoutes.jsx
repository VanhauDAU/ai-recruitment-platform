import { Routes, Route } from 'react-router-dom'
import AuthLayout from '../layouts/AuthLayout'
import DashboardLayout from '../layouts/DashboardLayout'
import AdminDashboard from '../pages/admin/Dashboard'
import Login from '../pages/auth/Login'
import Register from '../pages/auth/Register'
import CandidateDashboard from '../pages/candidate/Dashboard'
import EmployerDashboard from '../pages/employer/Dashboard'
import Home from '../pages/Home'
import NotFound from '../pages/NotFound'
import ProtectedRoute from './ProtectedRoute'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
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
  )
}
