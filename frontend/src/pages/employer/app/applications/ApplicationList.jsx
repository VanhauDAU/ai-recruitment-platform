import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Drawer,
  Empty,
  Input,
  Rate,
  Select,
  Skeleton,
  Table,
  Timeline,
  message,
} from 'antd'
import { useSearchParams } from 'react-router-dom'
import {
  applicationKeys,
  getApplicationHistory,
  getRecruiterApplicationSnapshot,
  getRecruiterApplications,
  RECRUITER_APPLICATION_STATUSES,
  RECRUITER_APPLICATION_STATUS_LABELS,
  updateApplicationStatus,
} from '@/entities/application'
import { CvDocumentPreview } from '@/entities/cv'

function documentFromVersion(version) {
  if (!version) return null
  return {
    schema_version: version.schema_version,
    content_json: version.content_json,
    layout_json: version.layout_json,
    style_json: version.style_json,
  }
}

export default function EmployerApplicationList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selected, setSelected] = useState(null)
  const [employerNote, setEmployerNote] = useState('')
  const [employerRating, setEmployerRating] = useState(null)
  const params = useMemo(() => Object.fromEntries(searchParams), [searchParams])
  const queryClient = useQueryClient()
  const applicationsQuery = useQuery({
    queryKey: applicationKeys.recruiterList(params),
    queryFn: () => getRecruiterApplications(params),
  })
  const snapshotQuery = useQuery({
    queryKey: applicationKeys.recruiterSnapshot(selected?.public_id),
    queryFn: () => getRecruiterApplicationSnapshot(selected.public_id),
    enabled: Boolean(selected),
  })
  const historyQuery = useQuery({
    queryKey: applicationKeys.history(selected?.public_id),
    queryFn: () => getApplicationHistory(selected.public_id),
    enabled: Boolean(selected),
  })
  useEffect(() => {
    if (snapshotQuery.data) {
      queryClient.invalidateQueries({ queryKey: ['applications', 'recruiter-list'] })
    }
  }, [queryClient, snapshotQuery.data])
  const updateMutation = useMutation({
    mutationFn: ({ publicId, payload }) => updateApplicationStatus(publicId, payload),
    onSuccess: (application) => {
      setSelected((current) => (current?.public_id === application.public_id ? application : current))
      queryClient.invalidateQueries({ queryKey: ['applications', 'recruiter-list'] })
      queryClient.invalidateQueries({ queryKey: applicationKeys.history(application.public_id) })
      queryClient.invalidateQueries({ queryKey: applicationKeys.recruiterSnapshot(application.public_id) })
      message.success('Đã cập nhật hồ sơ ứng tuyển.')
    },
    onError: () => message.error('Không thể cập nhật hồ sơ với trạng thái đã chọn.'),
  })
  const applications = useMemo(() => applicationsQuery.data || [], [applicationsQuery.data])
  const currentStatus = selected?.status || snapshotQuery.data?.status

  function populateSelectedApplication(application) {
    setSelected(application)
    setEmployerNote(application.employer_note || '')
    setEmployerRating(application.employer_rating || null)
  }

  function selectApplication(application) {
    populateSelectedApplication(application)
    if (searchParams.get('application') === application.public_id) return
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('application', application.public_id)
    setSearchParams(nextParams, { replace: true })
  }

  function closeApplicationDetail() {
    setSelected(null)
    if (!searchParams.has('application')) return
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('application')
    setSearchParams(nextParams, { replace: true })
  }

  useEffect(() => {
    const selectedPublicId = searchParams.get('application')
    if (!selectedPublicId || selected?.public_id === selectedPublicId) return
    const application = applications.find((item) => item.public_id === selectedPublicId)
    if (application) {
      setSelected(application)
      setEmployerNote(application.employer_note || '')
      setEmployerRating(application.employer_rating || null)
    }
  }, [applications, searchParams, selected?.public_id])

  function updateStatus(publicId, status) {
    updateMutation.mutate({ publicId, payload: { status } })
  }

  function saveAssessment() {
    if (!selected || !currentStatus) return
    updateMutation.mutate({
      publicId: selected.public_id,
      payload: {
        status: currentStatus,
        employer_note: employerNote,
        employer_rating: employerRating,
      },
    })
  }

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Quản lý CV ứng tuyển</h1>
        <p className="mt-1 text-sm text-slate-500">Chỉ hiển thị hồ sơ cho các tin do bạn tạo.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          allowClear
          placeholder="Tên hoặc email ứng viên"
          defaultValue={params.q}
          onPressEnter={(event) => setSearchParams({ ...params, q: event.target.value })}
        />
        <Select
          allowClear
          placeholder="Trạng thái"
          value={params.status}
          className="sm:w-52"
          options={RECRUITER_APPLICATION_STATUSES.map(([value, label]) => ({ value, label }))}
          onChange={(status) => setSearchParams({ ...params, ...(status ? { status } : {}) })}
        />
      </div>
      <Table
        rowKey="public_id"
        loading={applicationsQuery.isLoading}
        dataSource={applications}
        pagination={false}
        scroll={{ x: 760 }}
        locale={{ emptyText: <Empty description="Chưa có hồ sơ" /> }}
        columns={[
          {
            title: 'Ứng viên',
            render: (_, item) => (
              <button
                type="button"
                className="cursor-pointer text-left font-bold text-emerald-700"
                onClick={() => selectApplication(item)}
              >
                {item.candidate_name || item.candidate_email}
              </button>
            ),
          },
          { title: 'Tin tuyển dụng', dataIndex: 'job_title' },
          {
            title: 'Trạng thái',
            render: (_, item) => RECRUITER_APPLICATION_STATUS_LABELS[item.status] || item.status,
          },
          {
            title: 'Ngày nộp',
            dataIndex: 'applied_at',
            render: (value) => new Date(value).toLocaleDateString('vi-VN'),
          },
        ]}
      />
      <Drawer
        title={selected?.candidate_name || 'Hồ sơ ứng viên'}
        width="min(860px, 100vw)"
        open={Boolean(selected)}
        onClose={closeApplicationDetail}
      >
        {snapshotQuery.isLoading ? (
          <Skeleton active />
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-sm text-slate-500">CV đã nộp</p>
              <strong>{snapshotQuery.data?.submitted_cv_title}</strong>
              <p className="mt-2 text-sm text-slate-600">
                {snapshotQuery.data?.contact_email} · {snapshotQuery.data?.contact_phone}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="mb-2 text-sm font-semibold text-slate-800">Trạng thái xử lý</p>
              <Select
                aria-label="Cập nhật trạng thái hồ sơ"
                value={currentStatus}
                loading={updateMutation.isPending}
                className="w-full sm:w-64"
                options={RECRUITER_APPLICATION_STATUSES.map(([value, label]) => ({ value, label }))}
                onChange={(status) => updateStatus(selected.public_id, status)}
              />
            </div>
            {snapshotQuery.data?.cv && (
              <div className="overflow-auto rounded-lg bg-slate-100 p-3">
                <CvDocumentPreview
                  document={documentFromVersion(snapshotQuery.data.cv)}
                  rendererKey={snapshotQuery.data.cv.template_renderer_key}
                  assets={snapshotQuery.data.cv.assets}
                  editorChrome={false}
                />
              </div>
            )}
            <div className="space-y-3 rounded-lg border border-slate-200 p-4">
              <h2 className="font-bold">Đánh giá nội bộ</h2>
              <Rate value={employerRating} onChange={setEmployerRating} />
              <Input.TextArea
                value={employerNote}
                rows={3}
                maxLength={5000}
                onChange={(event) => setEmployerNote(event.target.value)}
                placeholder="Ghi chú này chỉ nhà tuyển dụng thấy"
              />
              <Button type="primary" loading={updateMutation.isPending} onClick={saveAssessment}>
                Lưu đánh giá
              </Button>
            </div>
            <div>
              <h2 className="mb-2 font-bold">Lịch sử xử lý</h2>
              <Timeline
                items={(historyQuery.data || []).map((item) => ({
                  children: (
                    <>
                      <strong>{RECRUITER_APPLICATION_STATUS_LABELS[item.to_status] || item.to_status}</strong>
                      <br />
                      <span className="text-xs text-slate-500">
                        {new Date(item.created_at).toLocaleString('vi-VN')}
                      </span>
                    </>
                  ),
                }))}
              />
            </div>
          </div>
        )}
      </Drawer>
    </section>
  )
}
