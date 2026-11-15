import { useQuery } from '@tanstack/react-query'
import { getMyCvs } from '@/entities/cv'

// Data hook cho trang Quản lý CV. Dùng chung key ['my-cvs'] để công tắc và
// popup "Cho phép NTD tìm kiếm" làm mới danh sách ngay sau khi lưu.
export function useMyCvsData() {
  const { data: cvs = [], isLoading, refetch } = useQuery({ queryKey: ['my-cvs', 'library'], queryFn: getMyCvs })

  return {
    builderCvs: cvs.filter((cv) => cv.cv_type === 'builder'),
    uploadedCvs: cvs.filter((cv) => cv.cv_type === 'uploaded'),
    loading: isLoading,
    refresh: refetch,
  }
}
