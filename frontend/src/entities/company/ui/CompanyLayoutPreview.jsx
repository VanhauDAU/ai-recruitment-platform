import { useMemo } from 'react'
import { applyPendingCompanyContent } from '../lib/company-content-overlay'
import { applyCompanyLayout } from '../lib/company-layout'
import CompanyProfileView from './CompanyProfileView'

/**
 * Bản xem trước trang công ty theo một bố cục chưa lưu: `content` là hồ sơ với
 * mọi khối có nội dung, `layout` là bản nháp. Có `pendingContent`
 * (`{ contentForm, benefits }`) thì nội dung đang chờ duyệt được phủ lên trước.
 * `narrow` ép bố cục một cột của màn hẹp vì breakpoint của bộ hiển thị tính
 * theo viewport, không theo khung.
 */
export default function CompanyLayoutPreview({ content, layout, registry, pendingContent, slots, narrow = false }) {
  const profile = useMemo(() => {
    const source = pendingContent
      ? applyPendingCompanyContent(content, pendingContent.contentForm, { registry, benefits: pendingContent.benefits })
      : content
    return applyCompanyLayout(source, layout, registry)
  }, [content, layout, registry, pendingContent])

  return (
    <div className={`company-profile-embedded ${narrow ? 'company-profile-embedded--narrow' : ''}`}>
      <CompanyProfileView profile={profile} slots={slots} preview />
    </div>
  )
}
