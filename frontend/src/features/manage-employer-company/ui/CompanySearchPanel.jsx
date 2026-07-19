import { BankOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Alert, Avatar, Button, Input, Pagination, Result, Skeleton, Tag } from 'antd'
import { useState } from 'react'
import { getEmployerCompanyList, joinEmployerCompany } from '@/entities/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

const STATUS = {
  verified: ['success', 'Đã xác thực'],
  pending: ['processing', 'Đang xác thực'],
  rejected: ['error', 'Cần cập nhật'],
  unverified: ['default', 'Chưa xác thực'],
}

function formatCompanySize(size) {
  if (!size) return 'Quy mô chưa cập nhật'
  return `${size} nhân viên`
}

export default function CompanySearchPanel({ onLinked, onCreateInstead }) {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const companiesQuery = useQuery({
    queryKey: ['employer', 'companies', query, page],
    queryFn: () => getEmployerCompanyList({ query, page }),
    placeholderData: (previous) => previous,
  })
  const joinMutation = useMutation({
    mutationFn: joinEmployerCompany,
    onSuccess: async () => {
      message.success('Đã liên kết công ty thành công.')
      await onLinked()
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể liên kết công ty.')),
  })

  function search() {
    setQuery(input.trim())
    setPage(1)
  }

  function selectCompany(company) {
    joinMutation.mutate({ company: company.public_id })
  }

  const payload = companiesQuery.data || {}
  const results = payload.results || []
  return (
    <section aria-labelledby="company-search-title">
      <div className="company-search-box">
        <div className="company-search-box__controls">
          <Input
            size="large"
            value={input}
            allowClear
            onChange={(event) => setInput(event.target.value)}
            onPressEnter={search}
            prefix={<SearchOutlined />}
            placeholder="Nhập tên công ty hoặc MST"
            aria-label="Tìm công ty"
          />
          <Button type="primary" size="large" onClick={search}>Tìm kiếm</Button>
        </div>
        <Alert
          className="company-search-box__notice"
          type="info"
          showIcon
          title={<span><strong>Lưu ý!</strong> Để tài khoản được xác thực nhanh chóng, vui lòng sử dụng <strong>Tên công ty</strong> trùng khớp với dữ liệu doanh nghiệp theo Trang thông tin điện tử của Cục Thuế.</span>}
        />
      </div>

      {companiesQuery.isLoading && <div className="mt-5 grid gap-4 md:grid-cols-2"><Skeleton active /><Skeleton active /></div>}
      {companiesQuery.isError && (
        <Result
          status="error"
          title="Không tải được danh sách công ty"
          subTitle={getApiErrorMessage(companiesQuery.error, 'Vui lòng thử lại sau.')}
          extra={<Button icon={<ReloadOutlined />} onClick={() => companiesQuery.refetch()}>Thử lại</Button>}
        />
      )}
      {!companiesQuery.isLoading && !companiesQuery.isError && results.length === 0 && (
        <Result status="info" title="Không tìm thấy công ty phù hợp" subTitle="Bạn có thể kiểm tra lại từ khóa hoặc tạo hồ sơ công ty mới." extra={<Button type="primary" onClick={onCreateInstead}>Tạo công ty mới</Button>} />
      )}
      {!companiesQuery.isLoading && !companiesQuery.isError && results.length > 0 && <h2 id="company-search-title" className="company-catalog-title">{query ? 'Kết quả tìm kiếm' : 'Công ty mới tạo'}</h2>}
      <div className="company-catalog-grid" aria-busy={companiesQuery.isFetching}>
        {results.map((company) => {
          const [statusColor, statusLabel] = STATUS[company.verification_status] || STATUS.unverified
          const industrySummary = (company.industries_detail || []).map((item) => item.name).join(' · ')
          return (
            <article key={company.public_id} className="company-catalog-card">
              <Avatar shape="square" size={58} src={company.logo_url || undefined} icon={<BankOutlined />} className="company-catalog-card__logo" />
              <div className="company-catalog-card__content">
                <div className="company-catalog-card__title-row">
                  <h3 title={company.company_name}>{company.company_name}</h3>
                  {company.verification_status !== 'unverified' && <Tag color={statusColor} className="company-catalog-card__status">{statusLabel}</Tag>}
                </div>
                <p className="company-catalog-card__tax">MST: {company.tax_code || 'chưa cập nhật'}</p>
                <p className="company-catalog-card__details">
                  <span title={company.address || ''}>{company.address || 'Địa chỉ chưa cập nhật'}</span>
                  <span aria-hidden="true">|</span>
                  <span>{formatCompanySize(company.company_size)}</span>
                </p>
                <div className="company-catalog-card__industries" title={industrySummary || undefined}>{(company.industries_detail || []).map((item) => <Tag key={item.id}>{item.name}</Tag>)}</div>
              </div>
              <Button size="small" loading={joinMutation.isPending} onClick={() => selectCompany(company)} className="company-catalog-card__action">Chọn</Button>
            </article>
          )
        })}
      </div>
      {payload.count > 6 && <Pagination className="!mt-6 !flex !justify-center" current={page} pageSize={6} total={payload.count} showSizeChanger={false} onChange={setPage} />}

    </section>
  )
}
