import { useParams, useSearchParams } from 'react-router'
import { parseCompanyDetailQuery, usePublicCompany } from '@/entities/company'
import { useSiteSettings } from '@/entities/site-settings'
import { useDocumentMetadata } from '@/shared/hooks/use-document-metadata'
import { PublicCompanyProfile } from '@/widgets/public-company-profile'
import { companyDetailMetadata } from './company-detail-metadata'

export default function CompanyDetail() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const { settings } = useSiteSettings()
  const { profile, isNotFound } = usePublicCompany(slug)
  const view = parseCompanyDetailQuery(searchParams)

  useDocumentMetadata(companyDetailMetadata({
    slug,
    profile,
    isNotFound,
    hasViewQuery: Boolean(view.tab),
    allowIndex: settings.seo_robots_index !== false,
  }))

  return <PublicCompanyProfile slug={slug} {...view} />
}
