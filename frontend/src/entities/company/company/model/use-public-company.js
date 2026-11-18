import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getPublicCompany } from '../api/company.api'
import { companyKeys } from '../api/company.keys'
import { preloadCompanyProfileView } from '../ui/company-profile-view-loader'

function isNotFound(error) {
  return error?.response?.status === 404
}

/**
 * Read model của trang công ty. Page (metadata) và widget (giao diện) cùng gọi
 * hook này; React Query gộp thành một request theo slug.
 */
export function usePublicCompany(slug) {
  const query = useQuery({
    queryKey: companyKeys.detail(slug),
    queryFn: ({ signal }) => getPublicCompany(slug, { signal }),
    enabled: Boolean(slug),
    // 404 là câu trả lời dứt khoát (slug lạ hoặc trang bị tạm ẩn), không thử lại.
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 1,
    staleTime: 60_000,
  })
  const notFound = isNotFound(query.error)

  // Nơi hỏi dữ liệu trang công ty sẽ render CompanyProfileView ngay sau đó: tải
  // chunk của bộ hiển thị song song với request thay vì chờ dữ liệu về.
  useEffect(() => {
    preloadCompanyProfileView()
  }, [])

  return {
    profile: query.data ?? null,
    isPending: query.isPending,
    isNotFound: notFound,
    isError: query.isError && !notFound,
    refetch: query.refetch,
  }
}
