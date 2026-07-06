import { Outlet } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-sm border border-gray-200">
        <h1 className="text-xl font-semibold text-center mb-6">AI Career Coach</h1>
        <Outlet />
      </div>
    </div>
  )
}
