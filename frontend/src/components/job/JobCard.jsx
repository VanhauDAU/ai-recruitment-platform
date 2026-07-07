import { EnvironmentOutlined, DollarOutlined, TeamOutlined } from '@ant-design/icons'
import { Tag } from 'antd'
import { Link } from 'react-router-dom'
import { EMPLOYMENT_TYPE_LABELS, formatLocations, formatSalary } from '../../constants/jobOptions'

export default function JobCard({ job }) {
  const locationLabel = formatLocations(job)
  return (
    <Link
      to={`/jobs/${job.slug}`}
      className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-400 hover:shadow-sm transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{job.title}</h3>
          <p className="text-sm text-gray-500 truncate">{job.company_name}</p>
        </div>
        {job.employment_type && (
          <Tag color="blue" className="shrink-0">{EMPLOYMENT_TYPE_LABELS[job.employment_type]}</Tag>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-gray-600">
        <span className="flex items-center gap-1">
          <DollarOutlined /> {formatSalary(job)}
        </span>
        {locationLabel && (
          <span className="flex items-center gap-1">
            <EnvironmentOutlined /> {locationLabel}
          </span>
        )}
        {job.number_of_vacancies && (
          <span className="flex items-center gap-1">
            <TeamOutlined /> {job.number_of_vacancies} người
          </span>
        )}
      </div>
    </Link>
  )
}
