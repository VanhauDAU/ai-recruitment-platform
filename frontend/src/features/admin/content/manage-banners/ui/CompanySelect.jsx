import { useQuery } from '@tanstack/react-query'
import { Select } from 'antd'
import { useEffect, useState } from 'react'
import { companyKeys, getPublicCompanies } from '@/entities/company/company'
import { m } from '@/shared/config/i18n'

const SEARCH_DELAY_MS = 300

/** Chọn công ty công khai theo tên; trả kèm object công ty để xem trước slide. */
export default function CompanySelect({ value, onChange, initialCompany, onCompany, id }) {
  const [search, setSearch] = useState('')
  const [keyword, setKeyword] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setKeyword(search.trim()), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [search])
  const query = useQuery({
    queryKey: [...companyKeys.all, 'banner-picker', keyword],
    queryFn: ({ signal }) => getPublicCompanies(keyword ? { q: keyword } : {}, { signal }),
    staleTime: 60_000,
  })
  const companies = query.data?.results || query.data || []
  const options = [initialCompany, ...companies]
    .filter((company, index, list) => company && list.findIndex((item) => item?.public_id === company.public_id) === index)
    .map((company) => ({ value: company.public_id, label: company.trade_name || company.company_name, company }))

  return (
    <Select
      id={id}
      showSearch
      allowClear
      value={value || undefined}
      filterOption={false}
      onSearch={setSearch}
      loading={query.isFetching}
      placeholder={m.admin_banner_company_placeholder()}
      notFoundContent={query.isFetching ? null : m.admin_banner_company_empty()}
      options={options}
      optionRender={(option) => (
        <span className="flex items-center gap-2">
          {option.data.company.logo_url && <img src={option.data.company.logo_url} alt="" className="size-5 rounded object-contain" />}
          <span className="truncate">{option.label}</span>
          <span className="ml-auto shrink-0 text-xs text-slate-400">
            {m.admin_banner_company_jobs({ count: option.data.company.active_public_job_count ?? 0 })}
          </span>
        </span>
      )}
      onChange={(next, option) => {
        onChange?.(next ?? null)
        onCompany?.(option?.company || null)
      }}
    />
  )
}
