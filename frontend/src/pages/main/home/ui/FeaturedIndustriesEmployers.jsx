import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getJobStats } from '@/entities/job'
import { logoUrlFor } from '../lib/logo-url'
import FeaturedEmployers from './FeaturedEmployers'
import FeaturedIndustries from './FeaturedIndustries'

// Section "Top ngành nghề" + "Nhà tuyển dụng nổi bật" trên trang chủ,
// dùng chung một lần tải job stats.
export default function FeaturedIndustriesEmployers() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    getJobStats().then(setStats).catch(() => {})
  }, [])

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
