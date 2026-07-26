import { ConfigProvider } from 'antd'
import { AuthLogo, LoginForm } from '@/features/auth'

// Cổng quản trị — sau này chạy trên subdomain riêng (vd. admin.procv.vn).
// Không có link đăng ký: tài khoản admin chỉ tạo qua backend.
export default function AdminLogin({ destinationResolver }) {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#0369a1', borderRadius: 10 } }}>
      <div
        className="w-full"
        style={{
          '--brand-primary': '#0369a1',
          '--brand-primary-hover': '#075985',
        }}
      >
        <div className="login-card mb-7 text-center">
          <AuthLogo className="mb-4" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            Đăng nhập quản trị
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
            Không gian vận hành dành cho tài khoản quản trị đã được cấp quyền.
          </p>
        </div>

        <LoginForm
          portal="admin"
          expectedRoles={['admin']}
          forgotPasswordLink={null}
          destinationResolver={destinationResolver}
        />

      </div>
    </ConfigProvider>
  )
}
