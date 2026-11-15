import { ReloadOutlined } from '@ant-design/icons'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Alert, Button, Segmented, Skeleton } from 'antd'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import {
  ADMIN_DASHBOARD_PERIODS,
  adminDashboardKeys,
  getAdminDashboard,
} from '@/entities/admin-dashboard'
import { buildQueues, formatTime, formatToday, greeting } from '../model/dashboard-model'
import ActionQueue from './ActionQueue'
import ActivityTrend from './ActivityTrend'
import {
  AiHealth,
  ApplicationFunnel,
  JobHealth,
  PlatformTotals,
  TopCategories,
  TrustSafety,
} from './InsightPanels'
import KpiStrip from './KpiStrip'
import '../admin-dashboard.css'

const DEFAULT_PERIOD = 30

function DashboardSkeleton() {
  return (
    <div className="admin-home__skeleton" aria-busy="true" aria-label="Đang tải bảng điều khiển…">
      <div className="admin-home__top">
        <Skeleton active paragraph={{ rows: 6 }} />
        <Skeleton active paragraph={{ rows: 4 }} />
      </div>
      <div className="admin-home-kpis">
        {ADMIN_DASHBOARD_PERIODS.concat(0).map((key) => <Skeleton.Node key={key} active className="admin-home__skeleton-tile" />)}
      </div>
      <Skeleton active paragraph={{ rows: 8 }} />
    </div>
  )
}

export default function AdminDashboardOverview({ displayName, tierLabel }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = Number(searchParams.get('period'))
  const period = ADMIN_DASHBOARD_PERIODS.includes(requested) ? requested : DEFAULT_PERIOD
  const query = useQuery({
    queryKey: adminDashboardKeys.detail(period),
    queryFn: ({ signal }) => getAdminDashboard(period, { signal }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    refetchOnWindowFocus: 'always',
    staleTime: 30_000,
  })
  const { data } = query
  const now = data ? new Date(data.generated_at).getTime() : Date.now()
  const queue = useMemo(() => buildQueues(data?.queues, now), [data?.queues, now])

  const changePeriod = (value) => {
    setSearchParams((params) => {
      const next = new URLSearchParams(params)
      if (value === DEFAULT_PERIOD) next.delete('period')
      else next.set('period', String(value))
      return next
    }, { replace: true })
  }

  return (
    <div className="admin-home">
      <header className="admin-home__header">
        <div className="min-w-0">
          <h1 className="admin-home__title">{greeting()}, {displayName}</h1>
          <p className="admin-home__subtitle">
            {formatToday()}. {tierLabel}.
            {data && <> Số liệu lúc {formatTime(data.generated_at)}.</>}
          </p>
        </div>
        <div className="admin-home__controls">
          <Segmented
            value={period}
            onChange={changePeriod}
            options={ADMIN_DASHBOARD_PERIODS.map((days) => ({ label: `${days} ngày`, value: days }))}
            aria-label="Kỳ thống kê"
          />
          <Button
            icon={<ReloadOutlined spin={query.isFetching} />}
            onClick={() => query.refetch()}
            aria-label="Làm mới số liệu"
          />
        </div>
      </header>

      {query.isError && !data && (
        <Alert
          type="error"
          showIcon
          message="Không tải được số liệu bảng điều khiển."
          action={<Button size="small" onClick={() => query.refetch()}>Thử lại</Button>}
        />
      )}
      {query.isPending && <DashboardSkeleton />}

      {data && (
        <div className={`admin-home__body ${query.isPlaceholderData ? 'admin-home__body--stale' : ''}`}>
          <div className="admin-home__top">
            <ActionQueue queue={queue} now={now} />
            <PlatformTotals totals={data.totals} />
          </div>
          <KpiStrip kpis={data.kpis} activity={data.activity} days={data.period.days} />
          <div className="admin-home__split">
            <ActivityTrend activity={data.activity} days={data.period.days} />
            <ApplicationFunnel applications={data.applications} days={data.period.days} />
          </div>
          <div className="admin-home__grid">
            <JobHealth jobs={data.jobs} />
            <TrustSafety trust={data.trust} content={data.content} days={data.period.days} />
            <TopCategories categories={data.top_categories} days={data.period.days} />
            <AiHealth ai={data.ai} days={data.period.days} />
          </div>
        </div>
      )}
    </div>
  )
}
