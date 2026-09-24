import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  COMPANY_DIRECTORY_PATH,
  companySearchPath,
} from '@/entities/company'
import { useDocumentMetadata } from '@/shared/hooks/use-document-metadata'
import { CompanyDirectory } from '@/widgets/company-directory'
import {
  createFeaturedRequestKey,
  FEATURED_REQUEST_STATE_KEY,
} from './company-route-state'

export default function CompanyList() {
  const navigate = useNavigate()
  const [featuredRequestKey] = useState(createFeaturedRequestKey)

  useDocumentMetadata({
    title: 'Danh sách công ty',
    description: 'Khám phá danh sách công ty, tìm hiểu doanh nghiệp và các cơ hội việc làm đang tuyển dụng.',
    canonicalPath: COMPANY_DIRECTORY_PATH,
  })

  function searchCompanies(keyword) {
    const normalizedKeyword = keyword.trim().slice(0, 120)
    navigate(companySearchPath(normalizedKeyword), {
      state: { [FEATURED_REQUEST_STATE_KEY]: featuredRequestKey },
    })
  }

  return (
    <CompanyDirectory
      mode="featured"
      query=""
      featuredRequestKey={featuredRequestKey}
      onQueryChange={searchCompanies}
    />
  )
}
