import { BankOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Alert, Avatar, Button, Input, Pagination, Result, Skeleton, Tag } from 'antd'
import { useState } from 'react'
import { getEmployerCompanyList, joinEmployerCompany } from '@/entities/account/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'

function formatCompanySize(size) {
  if (!size) return m.employer_company_size_unknown()
  return m.employer_company_size_employees({ size })
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
      message.success(m.employer_company_join_sent())
      await onLinked()
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_company_join_send_failed())),
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
            placeholder={m.employer_company_search_placeholder()}
            aria-label={m.employer_company_search_label()}
          />
          <Button type="primary" size="large" onClick={search}>{m.employer_company_search()}</Button>
        </div>
        <Alert
          className="company-search-box__notice"
          type="info"
          showIcon
          title={<span><strong>{m.employer_company_search_note_label()}</strong> {m.employer_company_search_note_body()} <strong>{m.employer_company_search_note_name()}</strong> {m.employer_company_search_note_tail()}</span>}
        />
      </div>

      {companiesQuery.isLoading && <div className="mt-5 grid gap-4 md:grid-cols-2"><Skeleton active /><Skeleton active /></div>}
      {companiesQuery.isError && (
        <Result
          status="error"
          title={m.employer_company_search_load_error()}
          subTitle={getApiErrorMessage(companiesQuery.error, m.employer_company_try_later())}
          extra={<Button icon={<ReloadOutlined />} onClick={() => companiesQuery.refetch()}>{m.employer_company_retry()}</Button>}
        />
      )}
      {!companiesQuery.isLoading && !companiesQuery.isError && results.length === 0 && (
        <Result status="info" title={m.employer_company_search_empty()} subTitle={m.employer_company_search_empty_hint()} extra={<Button type="primary" onClick={onCreateInstead}>{m.employer_company_flow_create_title()}</Button>} />
      )}
      {!companiesQuery.isLoading && !companiesQuery.isError && results.length > 0 && <h2 id="company-search-title" className="company-catalog-title">{query ? m.employer_company_search_results() : m.employer_company_search_recent()}</h2>}
      <div className="company-catalog-grid" aria-busy={companiesQuery.isFetching}>
        {results.map((company) => {
          const industrySummary = (company.industries_detail || []).map((item) => item.name).join(' · ')
          return (
            <article key={company.public_id} className="company-catalog-card">
              <Avatar shape="square" size={58} src={company.logo_url || undefined} icon={<BankOutlined />} className="company-catalog-card__logo" />
              <div className="company-catalog-card__content">
                <div className="company-catalog-card__title-row">
                  <h3 title={company.company_name}>{company.company_name}</h3>
                </div>
                <p className="company-catalog-card__tax">{m.employer_company_tax_code_value({ code: company.tax_code || m.employer_company_not_updated() })}</p>
                <p className="company-catalog-card__details">
                  <span title={company.address || ''}>{company.address || m.employer_company_address_unknown()}</span>
                  <span aria-hidden="true">|</span>
                  <span>{formatCompanySize(company.company_size)}</span>
                </p>
                <div className="company-catalog-card__industries" title={industrySummary || undefined}>{(company.industries_detail || []).map((item) => <Tag key={item.id}>{item.name}</Tag>)}</div>
              </div>
              <Button size="small" loading={joinMutation.isPending} onClick={() => selectCompany(company)} className="company-catalog-card__action">{m.employer_company_select()}</Button>
            </article>
          )
        })}
      </div>
      {payload.count > 6 && <Pagination className="!mt-6 !flex !justify-center" current={page} pageSize={6} total={payload.count} showSizeChanger={false} onChange={setPage} />}

    </section>
  )
}
