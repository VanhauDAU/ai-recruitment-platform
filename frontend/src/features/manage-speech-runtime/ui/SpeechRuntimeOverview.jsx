import { ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Descriptions, Skeleton, Statistic, Tag } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { getSpeechAdminOverview } from '@/entities/speech'

function formatBytes(value) {
  const bytes = Number(value) || 0
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

function statusColor(status) {
  if (status === 'ready') return 'green'
  if (status === 'disabled') return 'default'
  return 'orange'
}

export default function SpeechRuntimeOverview() {
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (signal) => {
    setRefreshing(true)
    try {
      setOverview(await getSpeechAdminOverview({ signal }))
      setError('')
    } catch (nextError) {
      if (nextError.name !== 'CanceledError') {
        setError('Không tải được trạng thái vận hành giọng đọc.')
      }
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  if (!overview && !error) return <Skeleton active paragraph={{ rows: 3 }} />
  if (!overview) return <Alert type="warning" showIcon message={error} />

  const { artifacts, policy, runtime, usage } = overview
  const generations = runtime.generations || {}
  const metrics = runtime.metrics || {}
  const cache = runtime.cache || {}
  const sevenDays = usage.days_7 || {}

  return (
    <Card
      size="small"
      title="Vận hành giọng đọc"
      className="!mb-4"
      extra={(
        <Button
          size="small"
          icon={<ReloadOutlined />}
          loading={refreshing}
          onClick={() => load()}
        >
          Làm mới
        </Button>
      )}
    >
      {runtime.status !== 'ready' && (
        <Alert
          type="info"
          showIcon
          className="!mb-4"
          message="TTS chưa nhận synthesis mới; các nội dung văn bản vẫn hoạt động bình thường."
        />
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Statistic title="Generation đang chạy" value={generations.active || 0} suffix={`/ ${generations.capacity || 0}`} />
        <Statistic title="Generation 7 ngày" value={sevenDays.generation_count || 0} />
        <Statistic title="Bị từ chối 7 ngày" value={sevenDays.rejected_count || 0} />
        <Statistic title="Cache local" value={formatBytes(cache.size_bytes)} />
      </div>
      <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }} className="!mt-4">
        <Descriptions.Item label="Runtime">
          <Tag color={statusColor(runtime.status)}>{runtime.status}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Model">{runtime.model_revision || 'Chưa kết nối'}</Descriptions.Item>
        <Descriptions.Item label="Backend">{runtime.backend || '—'} {runtime.precision || ''}</Descriptions.Item>
        <Descriptions.Item label="TTFA p95">{metrics.ttfa_ms_p95 == null ? '—' : `${metrics.ttfa_ms_p95} ms`}</Descriptions.Item>
        <Descriptions.Item label="RTF p95">{metrics.rtf_p95 ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="RAM TTS">{formatBytes(metrics.process_rss_bytes)}</Descriptions.Item>
        <Descriptions.Item label="Artifact durable">{artifacts.total || 0}</Descriptions.Item>
        <Descriptions.Item label="Dung lượng R2 đã ghi">{formatBytes(artifacts.size_bytes)}</Descriptions.Item>
        <Descriptions.Item label="Policy hiệu lực">
          <Tag color={policy.speech_blog_enabled ? 'green' : 'default'}>Blog</Tag>
          <Tag color={policy.speech_chatbot_enabled ? 'green' : 'default'}>Chatbot</Tag>
          <Tag color={policy.speech_onboarding_enabled ? 'green' : 'default'}>Onboarding</Tag>
        </Descriptions.Item>
      </Descriptions>
    </Card>
  )
}
