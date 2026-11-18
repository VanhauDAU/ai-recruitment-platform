import { useSession } from './use-session'

/**
 * Ai thấy hành động dành cho ứng viên trên trang công khai (theo dõi, báo cáo
 * công ty): `'guest'` được mời đăng nhập, `'candidate'` thao tác trực tiếp. Nhà
 * tuyển dụng, quản trị viên và phiên còn đang khôi phục trả `null` để nút không
 * hiện rồi lại biến mất.
 */
export function useCandidateAudience() {
  const { isAuthenticated, loading, user } = useSession()
  if (loading) return null
  if (!isAuthenticated) return 'guest'
  return user?.role === 'candidate' ? 'candidate' : null
}
