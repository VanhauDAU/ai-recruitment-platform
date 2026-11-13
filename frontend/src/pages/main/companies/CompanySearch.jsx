import { useState } from 'react'
import {
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router'
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

export default function CompanySearch() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [directRequestKey] = useState(createFeaturedRequestKey)
  const keyword = (searchParams.get('keyword') || '').trim().slice(0, 120)
  const inheritedRequestKey = location.state?.[FEATURED_REQUEST_STATE_KEY]
  const featuredRequestKey = typeof inheritedRequestKey === 'string'
    ? inheritedRequestKey
    : directRequestKey

  useDocumentMetadata({
    title: keyword ? `Công ty cho “${keyword}”` : 'Tìm kiếm công ty',
    description: 'Tìm kiếm công ty theo tên và khám phá các vị trí đang tuyển dụng.',
    canonicalPath: COMPANY_DIRECTORY_PATH,
    robots: 'noindex, nofollow',
  })

  function changeKeyword(nextKeyword) {
    const normalizedKeyword = nextKeyword.trim().slice(0, 120)
    if (!normalizedKeyword) {
      navigate(companySearchPath(''), {
        state: { [FEATURED_REQUEST_STATE_KEY]: featuredRequestKey },
      })
      return
    }
    navigate(companySearchPath(normalizedKeyword), {
      state: { [FEATURED_REQUEST_STATE_KEY]: featuredRequestKey },
    })
  }

  return (
    <CompanyDirectory
      mode="search"
      query={keyword}
      featuredRequestKey={featuredRequestKey}
      onQueryChange={changeKeyword}
    />
  )
}
