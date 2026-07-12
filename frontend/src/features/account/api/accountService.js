import api from '@/shared/api/client'

// Cập nhật họ tên + SĐT của tài khoản hiện tại (email không đổi ở đây).
// Backend trả về user đầy đủ để cập nhật thẳng vào auth context.
export async function updateProfile({ full_name, phone }) {
  const { data } = await api.patch('/auth/me/', { full_name, phone })
  return data
}
