import { useQuery } from '@tanstack/react-query'
import { BarChartOutlined, RiseOutlined } from '@ant-design/icons'
import { Select, Skeleton } from 'antd'
import { useMemo, useState } from 'react'
import { formatNumber as fmt, getJobStats, jobKeys } from '@/entities/job'
import { useCountUp } from '@/shared/hooks/use-count-up'
import { useInViewOnce } from '../model/use-in-view-once'
import LatestJobsFeed from './LatestJobsFeed'
import { DemandChart, GrowthChart } from './MarketCharts'

function StatTile({ value, label, animate }) {
  const display = useCountUp(value, { enabled: animate })
  return (
    <div className="rounded-lg bg-white/5 border border-white/10 p-3">
      <p className="text-2xl md:text-3xl font-bold tabular-nums">{fmt(display)}</p>
      <p className="text-xs text-green-100/70 mt-1 leading-tight">{label}</p>
    </div>
  )
}

function Panel({ icon, title, action, children }) {
  return (
    <div className="rounded-lg bg-white/5 border border-white/10 p-3">
      <div className="mb-2 flex items-center gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium flex items-center gap-1.5">
          <span className="text-[#3ddc84]">{icon}</span>
          <span className="truncate">{title}</span>
        </p>
        {action}
      </div>
      {children}
    </div>
  )
}

export default function MarketStats() {
  const [sectionRef, hasEnteredView] = useInViewOnce()
  const [demandType, setDemandType] = useState('category')
  const [chartAnimKey, setChartAnimKey] = useState(0)

  const { data: stats = null } = useQuery({
    queryKey: jobKeys.stats,
    queryFn: getJobStats,
    staleTime: 5 * 60_000,
  })

  const latest = useMemo(() => stats?.latest_jobs || [], [stats])

  const today = new Date().toLocaleDateString('vi-VN')
  const demandData = useMemo(
    () => (demandType === 'salary' ? stats?.salary_demand || [] : stats?.demand || []),
    [demandType, stats],
  )
  const demandTitle = demandType === 'salary' ? 'Nhu cầu tuyển dụng theo mức lương' : 'Nhu cầu tuyển dụng theo ngành nghề'

  function changeDemandType(value) {
    setDemandType(value)
    setChartAnimKey((key) => key + 1)
  }

  return (
    <div ref={sectionRef} className="rounded-xl bg-gradient-to-br from-[#0f3d2e] to-[#0a2a20] text-white p-5 md:p-6 shadow-lg">
      <h2 className="text-lg md:text-xl font-bold mb-5">
        Thị trường việc làm hôm nay <span className="text-[#3ddc84]">{today}</span>
      </h2>

      {!stats ? (
        <Skeleton active paragraph={{ rows: 6 }} className="[&_.ant-skeleton-title]:!bg-white/10 [&_.ant-skeleton-paragraph_li]:!bg-white/10" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
          <LatestJobsFeed jobs={latest} enabled={hasEnteredView} />

          {/* Right: stat tiles + charts */}
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <StatTile value={stats.new_jobs_24h} label="Việc làm mới 24h gần nhất" animate={hasEnteredView} />
              <StatTile value={stats.active_jobs} label="Việc làm đang tuyển" animate={hasEnteredView} />
              <StatTile value={stats.companies} label="Công ty đang tuyển" animate={hasEnteredView} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Panel icon={<RiseOutlined />} title="Tăng trưởng cơ hội việc làm 7 ngày">
                <GrowthChart data={stats.growth} animate={hasEnteredView} />
              </Panel>
              <Panel
                icon={<BarChartOutlined />}
                title={demandTitle}
                action={
                  <Select
                    size="small"
                    value={demandType}
                    onChange={changeDemandType}
                    options={[
                      { value: 'category', label: 'Ngành nghề' },
                      { value: 'salary', label: 'Mức lương' },
                    ]}
                    className="min-w-[116px] [&_.ant-select-selector]:!bg-white/10 [&_.ant-select-selector]:!border-white/20 [&_.ant-select-selection-item]:!text-white [&_.ant-select-arrow]:!text-white/70"
                  />
                }
              >
                <DemandChart key={`${chartAnimKey}-${hasEnteredView}`} data={demandData} animate={hasEnteredView} />
              </Panel>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
