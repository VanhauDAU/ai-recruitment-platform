import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Col, Descriptions, Modal, Row, Select, Skeleton, Statistic, Tag, message } from 'antd'
import { useParams } from 'react-router-dom'
import { CampaignForm } from '@/features/manage-campaigns'
import {
  CAMPAIGN_STATUS_LABELS,
  campaignKeys,
  changeCampaignStatus,
  getCampaign,
  getCampaignReport,
  updateCampaign,
} from '@/entities/campaign'
import { RECRUITER_APPLICATION_STATUS_LABELS } from '@/entities/application'
import { getJobCategories } from '@/entities/job'

export default function CampaignDetail() {
  const { publicId } = useParams()
  const [editing, setEditing] = useState(false)
  const queryClient = useQueryClient()
  const campaignQuery = useQuery({
    queryKey: campaignKeys.detail(publicId),
    queryFn: () => getCampaign(publicId),
  })
  const reportQuery = useQuery({
    queryKey: campaignKeys.report(publicId),
    queryFn: () => getCampaignReport(publicId),
  })
  const categoriesQuery = useQuery({
    queryKey: ['jobs', 'categories', 'specialization'],
    queryFn: () => getJobCategories({ category_type: 'specialization' }),
  })
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: campaignKeys.detail(publicId) })
    queryClient.invalidateQueries({ queryKey: campaignKeys.report(publicId) })
    queryClient.invalidateQueries({ queryKey: campaignKeys.all })
  }
  const updateMutation = useMutation({
    mutationFn: (payload) => updateCampaign(publicId, payload),
    onSuccess: () => {
      invalidate()
      setEditing(false)
      message.success('Đã cập nhật chiến dịch.')
    },
  })
  const statusMutation = useMutation({
    mutationFn: (status) => changeCampaignStatus(publicId, status),
    onSuccess: () => {
      invalidate()
      message.success('Đã đổi trạng thái chiến dịch.')
    },
  })

  if (campaignQuery.isLoading || reportQuery.isLoading) return <Skeleton active paragraph={{ rows: 10 }} />
  if (campaignQuery.isError || reportQuery.isError) return <Alert type="error" showIcon title="Không thể tải chiến dịch." />
  const campaign = campaignQuery.data
  const report = reportQuery.data

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{campaign.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {campaign.description || 'Theo dõi tiến độ tuyển dụng và phễu hồ sơ.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Select
            value={campaign.status}
            className="min-w-32"
            loading={statusMutation.isPending}
            options={Object.entries(CAMPAIGN_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
            onChange={(status) => statusMutation.mutate(status)}
          />
          <Button onClick={() => setEditing(true)}>Chỉnh sửa</Button>
        </div>
      </div>
      <Descriptions bordered size="small" column={{ xs: 1, md: 3 }}>
        <Descriptions.Item label="Trạng thái">
          <Tag color={campaign.status === 'active' ? 'green' : 'default'}>
            {CAMPAIGN_STATUS_LABELS[campaign.status]}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Mục tiêu">{campaign.headcount_target} người</Descriptions.Item>
        <Descriptions.Item label="Hạn hoàn thành">
          {campaign.target_date || 'Tuyển liên tục'}
        </Descriptions.Item>
      </Descriptions>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card><Statistic title="Tin tuyển dụng" value={report.jobs?.total || 0} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Hồ sơ ứng tuyển"
              value={Object.values(report.funnel || {}).reduce((sum, value) => sum + value, 0)}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Đã nhận offer"
              value={`${report.accepted_count || 0}/${report.headcount_target || 0}`}
            />
          </Card>
        </Col>
      </Row>
      <Card title="Phễu hồ sơ">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(report.funnel || {}).map(([status, count]) => (
            <div key={status} className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">
                {RECRUITER_APPLICATION_STATUS_LABELS[status] || status}
              </p>
              <strong className="text-xl text-slate-900">{count}</strong>
            </div>
          ))}
        </div>
      </Card>
      <Modal
        open={editing}
        title="Chỉnh sửa chiến dịch"
        footer={null}
        width={760}
        onCancel={() => setEditing(false)}
      >
        <CampaignForm
          initialValues={campaign}
          categories={categoriesQuery.data || []}
          submitting={updateMutation.isPending}
          onSubmit={(payload) => updateMutation.mutate(payload)}
          onCancel={() => setEditing(false)}
        />
      </Modal>
    </section>
  )
}
