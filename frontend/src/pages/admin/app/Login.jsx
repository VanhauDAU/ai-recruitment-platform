import AuthLogo from '../../components/auth/AuthLogo'
import LoginForm from '../../components/auth/LoginForm'

// Cổng quản trị — sau này chạy trên subdomain riêng (vd. admin.procv.vn).
// Không có link đăng ký: tài khoản admin chỉ tạo qua backend.
export default function AdminLogin() {
  return (
    <div className="w-full">
      <div className="login-card mb-7 text-center">
        <AuthLogo className="mb-3" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Đăng nhập Quản trị hệ thống
        </h2>
      </div>

      <LoginForm portal="admin" expectedRoles={['admin']} forgotPasswordLink={null} />
    </div>
  )
}
