import {
  ClockCircleOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  ReadOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Button, Result, Skeleton, Tag, message } from 'antd'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getJobDetail } from '../../api/jobService'
import {
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LEVEL_LABELS,
  WORK_TYPE_LABELS,
  formatEducation,
  formatSalary,
} from '../../constants/jobOptions'
import { useAuth } from '../../hooks/useAuth'

export default function JobDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    setLoading(true)
    setNotFound(false)
    getJobDetail(slug)
      .then(setJob)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  function handleApply() {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    if (user?.role !== 'candidate') {
      message.warning('Chỉ ứng viên mới có thể ứng tuyển.')
      return
    }
    message.info('Tính năng ứng tuyển sẽ sớm ra mắt.')
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <Skeleton active title={{ width: '50%' }} paragraph={{ rows: 3 }} />
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <Skeleton active paragraph={{ rows: 4 }} />
          </div>
        </div>
        <div className="md:col-span-1 bg-white border border-gray-200 rounded-lg p-6">
          <Skeleton.Button active block />
          <Skeleton active title={false} paragraph={{ rows: 2 }} className="mt-4" />
        </div>
      </div>
    )
  }

  if (notFound || !job) {
    return (
      <Result
        status="404"
        title="Không tìm thấy tin tuyển dụng"
        extra={<Link to="/viec-lam"><Button type="primary">Xem việc làm khác</Button></Link>}
      />
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-4">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
          <p className="text-gray-500 mt-1">{job.company_name}</p>
          <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
            <span className="flex items-center gap-1"><DollarOutlined /> {formatSalary(job)}</span>
            {job.number_of_vacancies && (
              <span className="flex items-center gap-1"><TeamOutlined /> {job.number_of_vacancies} người</span>
            )}
            {formatEducation(job.education_level) && (
              <span className="flex items-center gap-1"><ReadOutlined /> {formatEducation(job.education_level)}</span>
            )}
            {job.deadline && (
              <span className="flex items-center gap-1"><ClockCircleOutlined /> Hạn nộp: {job.deadline}</span>
            )}
          </div>
          {job.locations_detail?.length > 0 && (
            <div className="flex items-start gap-1.5 mt-3 text-sm text-gray-600">
              <EnvironmentOutlined className="mt-0.5" />
              <span>{job.locations_detail.map((l) => l.name).join(' · ')}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-4">
            {job.work_type && <Tag color="blue">{WORK_TYPE_LABELS[job.work_type]}</Tag>}
            {job.employment_type && <Tag color="green">{EMPLOYMENT_TYPE_LABELS[job.employment_type]}</Tag>}
            {job.experience_level && <Tag color="purple">{EXPERIENCE_LEVEL_LABELS[job.experience_level]}</Tag>}
          </div>
        </div>

        <JobSection title="Mô tả công việc" content={job.description} />
        <JobSection title="Trách nhiệm" content={job.responsibilities} />
        <JobSection title="Yêu cầu ứng viên" content={job.requirements} />
        <JobSection title="Ưu tiên" content={job.nice_to_have} />
        <JobSection title="Quyền lợi" content={job.benefits} />
      </div>

      <div className="md:col-span-1">
        <div className="bg-white border border-gray-200 rounded-lg p-6 sticky top-20 space-y-4">
          <Button type="primary" size="large" block onClick={handleApply}>
            Ứng tuyển ngay
          </Button>
          <div>
            <p className="text-sm text-gray-500">Công ty</p>
            <p className="font-medium">{job.company_name}</p>
          </div>
          {job.address && (
            <div>
              <p className="text-sm text-gray-500">Địa chỉ</p>
              <p>{job.address}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function JobSection({ title, content }) {
  if (!content) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="font-semibold text-gray-900 mb-2">{title}</h2>
      <p className="whitespace-pre-line text-gray-700 text-sm leading-relaxed">{content}</p>
    </div>
  )
}
