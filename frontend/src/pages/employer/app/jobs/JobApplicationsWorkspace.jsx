import {
  FileSearchOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Button, Empty, Input, Select, Table, Tag } from 'antd'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  RECRUITER_APPLICATION_STATUS_LABELS,
  RECRUITER_APPLICATION_STATUSES,
} from '@/entities/application'

const SOURCE_LABELS = {
  applied: 'Ứng tuyển',
  recommended: 'Đề xuất',
  invited: 'Mời ứng tuyển',
}

function CandidateMobileCard({ application, manageUrl }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 font-bold text-emerald-600"><UserOutlined /></span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold text-slate-800">{application.candidate_name || application.candidate_email}</h3>
          <p className="mt-0.5 truncate text-xs text-slate-500">{application.candidate_email}</p>
        </div>
        <Tag className="!m-0">{SOURCE_LABELS[application.source] || application.source}</Tag>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div><p className="text-slate-400">CV đã nộp</p><p className="mt-1 truncate font-semibold text-slate-700">{application.submitted_cv_title || application.cv_title || 'CV ứng viên'}</p></div>
        <div><p className="text-slate-400">Ngày nộp</p><p className="mt-1 font-semibold text-slate-700">{new Date(application.applied_at).toLocaleDateString('vi-VN')}</p></div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <Tag className="!m-0">{RECRUITER_APPLICATION_STATUS_LABELS[application.status] || application.status}</Tag>
        <Button size="small"><Link to={manageUrl}>Xem hồ sơ</Link></Button>
      </div>
    </article>
  )
}

export default function JobApplicationsWorkspace({ jobPublicId, applications, loading }) {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState()
  const appliedApplications = useMemo(() => applications.filter((item) => item.source === 'applied'), [applications])
  const filteredApplications = useMemo(() => appliedApplications.filter((item) => {
    const searchText = `${item.candidate_name || ''} ${item.candidate_email || ''} ${item.submitted_cv_title || ''}`.toLocaleLowerCase('vi-VN')
    return (!keyword || searchText.includes(keyword.toLocaleLowerCase('vi-VN'))) && (!status || item.status === status)
  }), [appliedApplications, keyword, status])
  const unseenCount = appliedApplications.filter((item) => item.status === 'submitted').length
  const pendingCount = appliedApplications.filter((item) => ['submitted', 'viewed'].includes(item.status)).length
  function manageUrl(application) {
    const query = new URLSearchParams({ job: jobPublicId })
    if (application?.candidate_email) query.set('q', application.candidate_email)
    if (application?.public_id) query.set('application', application.public_id)
    return `/tuyendung/app/applications?${query}`
  }

  const columns = [
    {
      title: 'Ứng viên',
      render: (_, item) => (
        <div className="min-w-40">
          <p className="font-bold text-slate-800">{item.candidate_name || item.candidate_email}</p>
          <p className="mt-0.5 text-xs text-slate-400">{item.candidate_email}</p>
        </div>
      ),
    },
    {
      title: 'CV đã nộp',
      render: (_, item) => <span className="font-medium text-slate-700">{item.submitted_cv_title || item.cv_title || 'CV ứng viên'}</span>,
    },
    {
      title: 'Trạng thái',
      render: (_, item) => <Tag>{RECRUITER_APPLICATION_STATUS_LABELS[item.status] || item.status}</Tag>,
    },
    {
      title: 'Ngày nộp',
      dataIndex: 'applied_at',
      render: (value) => new Date(value).toLocaleDateString('vi-VN'),
    },
    {
      title: '',
      render: (_, item) => <Button size="small"><Link to={manageUrl(item)}>Xem hồ sơ</Link></Button>,
    },
  ]

  return (
    <div className="min-w-0 p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(220px,1fr)_200px] lg:max-w-2xl">
          <Input
            allowClear
            prefix={<SearchOutlined className="text-slate-400" />}
            placeholder="Tìm tên, email hoặc tên CV"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <Select
            allowClear
            placeholder="Tất cả trạng thái"
            value={status}
            options={RECRUITER_APPLICATION_STATUSES.map(([value, label]) => ({ value, label }))}
            onChange={setStatus}
          />
        </div>
        <Button icon={<FileSearchOutlined />}><Link to={manageUrl()}>Mở trang quản lý CV</Link></Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-y border-slate-100 py-3 text-sm">
        <span className="font-semibold text-slate-700">Tìm thấy {filteredApplications.length} ứng viên</span>
        <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">CV chưa xem: {unseenCount}</span>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">CV chưa phản hồi: {pendingCount}</span>
      </div>

      <div className="mt-4 hidden overflow-hidden rounded-xl border border-slate-200 md:block">
        <Table
          rowKey="public_id"
          loading={loading}
          dataSource={filteredApplications}
          pagination={false}
          scroll={{ x: 820 }}
          locale={{ emptyText: <Empty description="Chưa có CV ứng tuyển" /> }}
          columns={columns}
        />
      </div>
      <div className="mt-4 grid gap-3 md:hidden">
        {loading && <p className="py-8 text-center text-sm text-slate-500">Đang tải CV ứng tuyển...</p>}
        {!loading && filteredApplications.map((item) => (
          <CandidateMobileCard
            key={item.public_id}
            application={item}
            manageUrl={manageUrl(item)}
          />
        ))}
        {!loading && filteredApplications.length === 0 && <Empty description="Chưa có CV ứng tuyển" />}
      </div>
    </div>
  )
}
