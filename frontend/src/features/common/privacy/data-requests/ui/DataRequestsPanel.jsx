import { DeleteOutlined, DownloadOutlined, ExportOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Input, Modal, Skeleton, Tag } from 'antd'
import { useState } from 'react'
import {
  DATA_REQUEST_STATUS_COLORS,
  cancelDataRequest,
  dataRequestKeys,
  fetchDataExport,
  listMyDataRequests,
  submitDataRequest,
} from '@/entities/account/data-request'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { formatDateTime } from '@/shared/lib/date-time'
import { triggerBlobDownload } from '@/shared/lib/download-blob'
import { message } from '@/shared/lib/toast'

function RightCard({ icon, title, description, children }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-lg text-slate-400">{icon}</span>
        <div className="min-w-0">
          <h4 className="font-semibold text-slate-800">{title}</h4>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        </div>
      </div>
      <div className="mt-auto">{children}</div>
    </div>
  )
}

/** Quyền xuất dữ liệu và xóa tài khoản (Nghị định 13/2023) — dùng ở cả cổng ứng viên và NTD. */
export default function DataRequestsPanel() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: dataRequestKeys.mine, queryFn: listMyDataRequests })
  const requests = Array.isArray(data) ? data : []
  const [erasureOpen, setErasureOpen] = useState(false)
  const [note, setNote] = useState('')
  const refresh = () => queryClient.invalidateQueries({ queryKey: dataRequestKeys.mine })
  const isPending = (kind) => requests.some((item) => item.kind === kind && item.status === 'pending')

  const submit = useMutation({
    mutationFn: submitDataRequest,
    onSuccess: () => {
      message.success(m.privacy_request_sent())
      setErasureOpen(false)
      setNote('')
      refresh()
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.privacy_request_failed())),
  })
  const cancel = useMutation({
    mutationFn: cancelDataRequest,
    onSuccess: () => { message.success(m.privacy_history_cancelled()); refresh() },
    onError: (error) => message.error(getApiErrorMessage(error, m.privacy_cancel_failed())),
  })
  const download = useMutation({
    mutationFn: async (publicId) => {
      triggerBlobDownload(await fetchDataExport(publicId), `procv-data-${publicId}.json`)
    },
    onError: () => message.error(m.privacy_download_failed()),
  })

  if (isLoading) return <Skeleton active paragraph={{ rows: 4 }} />

  const pendingLabel = m.privacy_pending()
  return (
    <section className="max-w-[720px]">
      <h3 className="text-base font-semibold text-slate-800">{m.privacy_requests_title()}</h3>
      <p className="text-sm text-slate-500">{m.privacy_requests_subtitle()}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <RightCard icon={<ExportOutlined />} title={m.privacy_export_title()} description={m.privacy_export_desc()}>
          <Button
            block
            disabled={isPending('export')}
            loading={submit.isPending && submit.variables?.kind === 'export'}
            onClick={() => submit.mutate({ kind: 'export' })}
          >
            {isPending('export') ? pendingLabel : m.privacy_export_action()}
          </Button>
        </RightCard>
        <RightCard icon={<DeleteOutlined />} title={m.privacy_erasure_title()} description={m.privacy_erasure_desc()}>
          <Button block danger disabled={isPending('erasure')} onClick={() => setErasureOpen(true)}>
            {isPending('erasure') ? pendingLabel : m.privacy_erasure_action()}
          </Button>
        </RightCard>
      </div>

      {requests.length > 0 && (
        <>
          <h4 className="mt-6 text-sm font-semibold text-slate-700">{m.privacy_history_title()}</h4>
          <ul className="mt-2 space-y-2">
            {requests.map((item) => {
              const exportReady = item.export_available_until && new Date(item.export_available_until) > new Date()
              return (
                <li key={item.public_id} className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 font-medium text-slate-800">
                      {item.kind_label}
                      <Tag color={DATA_REQUEST_STATUS_COLORS[item.status]} className="!m-0">{item.status_label}</Tag>
                    </div>
                    <p className="text-slate-500">
                      {m.privacy_history_sent_at({ time: formatDateTime(item.created_at) })}
                      {exportReady && ` · ${m.privacy_history_available_until({ time: formatDateTime(item.export_available_until) })}`}
                    </p>
                    {item.resolution_note && <p className="text-slate-600">{m.privacy_history_response({ note: item.resolution_note })}</p>}
                  </div>
                  {exportReady && (
                    <Button size="small" type="primary" icon={<DownloadOutlined />} loading={download.isPending} onClick={() => download.mutate(item.public_id)}>
                      {m.privacy_history_download()}
                    </Button>
                  )}
                  {item.status === 'pending' && (
                    <Button size="small" loading={cancel.isPending} onClick={() => cancel.mutate(item.public_id)}>
                      {m.privacy_history_cancel()}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}

      <Modal
        open={erasureOpen}
        title={m.privacy_erasure_confirm_title()}
        okText={m.privacy_erasure_submit()}
        okButtonProps={{ danger: true, loading: submit.isPending }}
        cancelText={m.common_action_cancel()}
        onOk={() => submit.mutate({ kind: 'erasure', note })}
        onCancel={() => setErasureOpen(false)}
        destroyOnHidden
      >
        <p className="text-sm leading-6 text-slate-600">{m.privacy_erasure_confirm_body()}</p>
        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="privacy-erasure-note">{m.privacy_erasure_note_label()}</label>
        <Input.TextArea
          id="privacy-erasure-note"
          className="!mt-1"
          maxLength={1000}
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Modal>
    </section>
  )
}
