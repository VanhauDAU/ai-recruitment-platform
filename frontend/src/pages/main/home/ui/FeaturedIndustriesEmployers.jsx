import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { companyKeys, getPublicCompanies } from '@/entities/company'
import { getJobStats, jobKeys } from '@/entities/job'
import FeaturedEmployers from './FeaturedEmployers'
import FeaturedIndustries from './FeaturedIndustries'

// Section "Top ngành nghề" + "Nhà tuyển dụng nổi bật" trên trang chủ.
// Thống kê dùng chung query key với MarketStats. Công ty nổi bật phải lấy từ
// cùng public API với /cong-ty để không nhân bản eligibility/ranking ở trang chủ.
export default function FeaturedIndustriesEmployers() {
  const navigate = useNavigate()
  const { data: stats = null } = useQuery({
    queryKey: jobKeys.stats,
    queryFn: getJobStats,
    staleTime: 5 * 60_000,
  })
  const { data: featuredResponse = null } = useQuery({
    queryKey: companyKeys.featured('homepage'),
    queryFn: ({ signal }) => getPublicCompanies({}, { signal }),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  })

  const industries = useMemo(() => stats?.demand || [], [stats])
  const featuredCompanies = useMemo(
    () => featuredResponse?.results || [],
    [featuredResponse],
  )

  if (!stats || (industries.length === 0 && featuredCompanies.length === 0)) return null

  return (
    <section className="overflow-hidden bg-white py-10">
      <div className="mx-auto max-w-6xl px-4">
        <FeaturedIndustries industries={industries} navigate={navigate} />
        <FeaturedEmployers employers={featuredCompanies} navigate={navigate} stats={stats} />
      </div>
    </section>
  )
}
