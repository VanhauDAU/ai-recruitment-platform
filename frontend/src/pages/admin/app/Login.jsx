import { LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
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
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-xl text-sky-700 dark:bg-sky-950 dark:text-sky-300">
            <SafetyCertificateOutlined />
          </span>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-300">
            Admin Console
          </p>
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

        <div className="login-field mt-6 flex items-start gap-3 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-left dark:border-sky-900 dark:bg-sky-950/50">
          <LockOutlined className="mt-1 shrink-0 text-sky-700 dark:text-sky-300" />
          <p className="m-0 text-xs leading-5 text-slate-600 dark:text-slate-300">
            Phiên đăng nhập được bảo vệ theo vai trò và quyền phòng ban. Không chia sẻ thông tin truy cập với người khác.
          </p>
        </div>
      </div>
    </ConfigProvider>
  )
}
