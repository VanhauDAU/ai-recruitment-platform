import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getJobStats, jobKeys } from '@/entities/job'
import { logoUrlFor } from '../lib/logo-url'
import FeaturedEmployers from './FeaturedEmployers'
import FeaturedIndustries from './FeaturedIndustries'

// Section "Top ngành nghề" + "Nhà tuyển dụng nổi bật" trên trang chủ.
// Query key dùng chung với MarketStats nên cả trang chỉ tải stats một lần.
export default function FeaturedIndustriesEmployers() {
  const navigate = useNavigate()
  const { data: stats = null } = useQuery({
    queryKey: jobKeys.stats,
    queryFn: getJobStats,
    staleTime: 5 * 60_000,
  })

  const industries = useMemo(() => stats?.demand || [], [stats])
  const employers = useMemo(() => stats?.featured_employers || [], [stats])
  const logoEmployers = useMemo(() => employers.filter((employer) => logoUrlFor(employer)), [employers])

  if (!stats || (industries.length === 0 && logoEmployers.length === 0)) return null

  return (
    <section className="overflow-hidden bg-white py-10">
      <div className="mx-auto max-w-6xl px-4">
        <FeaturedIndustries industries={industries} navigate={navigate} />
        <FeaturedEmployers employers={logoEmployers} navigate={navigate} />
      </div>
    </section>
  )
}
