import { useQuery } from '@tanstack/react-query'
import { Empty, Skeleton, Tag, Timeline } from 'antd'
import { CANDIDATE_APPLICATION_STATUS_LABELS, applicationKeys, getCandidateApplications } from '@/entities/application'

const STATUS_COLORS = { submitted: 'blue', viewed: 'cyan', considering: 'gold', shortlisted: 'gold', interviewed: 'purple', accepted: 'green', rejected: 'default' }

export default function AppliedJobs() {
  const applicationsQuery = useQuery({ queryKey: applicationKeys.candidateList, queryFn: getCandidateApplications })
  if (applicationsQuery.isLoading) return <Skeleton active paragraph={{ rows: 10 }} />
  const applications = applicationsQuery.data || []
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="mb-6"><h1 className="text-xl font-extrabold text-slate-900">Việc làm đã ứng tuyển</h1><p className="mt-1 text-sm text-slate-500">Theo dõi các mốc xử lý hồ sơ mà nhà tuyển dụng chia sẻ với bạn.</p></div>{!applications.length ? <Empty description="Bạn chưa ứng tuyển việc làm nào" /> : <div className="space-y-4">{applications.map((application) => <article key={application.public_id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-bold text-slate-900">{application.job_title}</h2><p className="mt-1 text-xs text-slate-500">Đã nộp ngày {new Date(application.applied_at).toLocaleDateString('vi-VN')} · CV: {application.submitted_cv_title}</p></div><Tag color={STATUS_COLORS[application.status]}>{application.candidate_status || CANDIDATE_APPLICATION_STATUS_LABELS[application.status]}</Tag></div><Timeline className="mt-5" items={(application.timeline || []).map((item) => ({ children: <><strong className="text-sm text-slate-700">{item.label}</strong><br /><span className="text-xs text-slate-500">{new Date(item.occurred_at).toLocaleString('vi-VN')}</span></> }))} /></article>)}</div>}</section>
}
