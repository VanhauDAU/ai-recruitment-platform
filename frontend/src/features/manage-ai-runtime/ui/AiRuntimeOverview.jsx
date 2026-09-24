import { ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Descriptions, Skeleton, Statistic, Tag } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { getAiRuntimeOverview } from '@/entities/ai-runtime'

const EMPTY_OBJECT = Object.freeze({})

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : EMPTY_OBJECT
}

function firstNumber(...values) {
  const value = values.find((candidate) => (
    candidate !== '' && candidate != null && Number.isFinite(Number(candidate))
  ))
  return value == null ? 0 : Number(value)
}

function firstText(...values) {
  const value = values.find((candidate) => (
    typeof candidate === 'string' && candidate.trim()
  ))
  return value?.trim() || '—'
}

function formatInteger(value) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(
    firstNumber(value),
  )
}

function formatUsd(value) {
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    maximumFractionDigits: 4,
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(firstNumber(value))
}

function formatRate(value) {
  const numericValue = firstNumber(value)
  const normalized = numericValue > 1 ? numericValue : numericValue * 100
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(normalized)}%`
}

function runtimeStatus(runtime) {
  if (typeof runtime.status === 'string' && runtime.status.trim()) {
    return runtime.status.trim().toLowerCase()
  }
  if (runtime.enabled === false) return 'disabled'
  if (runtime.enabled === true) return 'ready'
  return 'unknown'
}

function statusColor(status) {
  if (['ready', 'healthy', 'enabled'].includes(status)) return 'green'
  if (['disabled', 'off'].includes(status)) return 'default'
  if (['degraded', 'recovering'].includes(status)) return 'orange'
  return 'red'
}

function isCancelled(error, signal) {
  return signal?.aborted
    || error?.name === 'AbortError'
    || error?.name === 'CanceledError'
    || error?.code === 'ERR_CANCELED'
}

function usageFor(overview, days) {
  return asObject(asObject(overview.usage)[`days_${days}`])
}

function generationsFor(overview, days) {
  return asObject(asObject(overview.generations)[`days_${days}`])
}

function periodCounts(overview, days) {
  const usage = usageFor(overview, days)
  const generations = generationsFor(overview, days)
  return {
    failures: firstNumber(
      generations.failed,
      generations.error_count,
      usage.failure_count,
      usage.error_count,
    ),
    successes: firstNumber(
      generations.completed,
      generations.success_count,
      usage.success_count,
    ),
  }
}

export default function AiRuntimeOverview() {
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (signal) => {
    setRefreshing(true)
    try {
      const response = await getAiRuntimeOverview({ signal })
      if (!signal?.aborted) {
        setOverview(asObject(response))
        setError('')
      }
    } catch (nextError) {
      if (!isCancelled(nextError, signal)) {
        setError('Không tải được số liệu vận hành AI tạo tin tuyển dụng.')
      }
    } finally {
      if (!signal?.aborted) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  if (!overview && !error) {
    return <Skeleton active paragraph={{ rows: 5 }} />
  }

  if (!overview) {
    return (
      <Alert
        action={<Button onClick={() => load()}>Thử lại</Button>}
        className="!mb-4"
        description="Hãy kiểm tra kết nối hoặc quyền truy cập rồi tải lại số liệu."
        showIcon
        title={error}
        type="warning"
      />
    )
  }

  const runtime = asObject(overview.runtime)
  const queue = asObject(overview.queue)
  const policy = asObject(overview.policy)
  const sevenDayCounts = periodCounts(overview, 7)
  const thirtyDayCounts = periodCounts(overview, 30)
  const thirtyDayUsage = usageFor(overview, 30)
  const thirtyDayGenerations = generationsFor(overview, 30)
  const status = runtimeStatus(runtime)
  const totalTokens = firstNumber(
    thirtyDayUsage.total_tokens,
    firstNumber(thirtyDayUsage.input_tokens) + firstNumber(thirtyDayUsage.output_tokens),
  )
  const queueActive = firstNumber(queue.active, queue.processing, queue.in_progress)
  const queueWaiting = firstNumber(queue.waiting, queue.queued, queue.pending)

  return (
    <Card
      size="small"
      title="Vận hành AI tạo tin tuyển dụng"
      className="!mb-4"
      extra={(
        <Button
          aria-label="Làm mới số liệu AI"
          size="small"
          icon={<ReloadOutlined />}
          loading={refreshing}
          onClick={() => load()}
        >
          Làm mới
        </Button>
      )}
    >
      {error && (
        <Alert
          action={<Button size="small" onClick={() => load()}>Thử lại</Button>}
          className="!mb-4"
          showIcon
          title={error}
          type="warning"
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Statistic title="Thành công 7 ngày" value={sevenDayCounts.successes} />
        <Statistic title="Lỗi 7 ngày" value={sevenDayCounts.failures} />
        <Statistic title="Thành công 30 ngày" value={thirtyDayCounts.successes} />
        <Statistic title="Lỗi 30 ngày" value={thirtyDayCounts.failures} />
        <Statistic
          title="Độ trễ P95 (30 ngày)"
          value={firstNumber(
            thirtyDayUsage.p95_latency_ms,
            thirtyDayUsage.latency_ms_p95,
          )}
          formatter={formatInteger}
          suffix="ms"
        />
        <Statistic title="Token (30 ngày)" value={totalTokens} formatter={formatInteger} />
        <Statistic
          title="Chi phí (30 ngày)"
          value={firstNumber(thirtyDayUsage.cost_usd, thirtyDayUsage.estimated_cost_usd)}
          formatter={formatUsd}
        />
        <Statistic
          title="Tỷ lệ áp dụng (30 ngày)"
          value={firstNumber(thirtyDayGenerations.apply_rate)}
          formatter={formatRate}
        />
      </div>

      <Descriptions
        size="small"
        column={{ xs: 1, sm: 2, lg: 3 }}
        className="!mt-4"
      >
        <Descriptions.Item label="Runtime">
          <Tag color={statusColor(status)}>{status}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Provider">
          {firstText(runtime.provider, policy.provider)}
        </Descriptions.Item>
        <Descriptions.Item label="Backend">
          {firstText(runtime.provider_backend, runtime.backend, policy.provider_backend)}
        </Descriptions.Item>
        <Descriptions.Item label="Model">
          {firstText(runtime.model, policy.model)}
        </Descriptions.Item>
        <Descriptions.Item label="Queue">
          <span className="break-words">
            {firstText(queue.name, runtime.queue, 'ai-generation')}
            {' · '}
            {formatInteger(queueActive)} đang chạy
            {' · '}
            {formatInteger(queueWaiting)} chờ
          </span>
        </Descriptions.Item>
        <Descriptions.Item label="Từ chối quota (30 ngày)">
          {formatInteger(thirtyDayUsage.quota_rejection_count)}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  )
}
