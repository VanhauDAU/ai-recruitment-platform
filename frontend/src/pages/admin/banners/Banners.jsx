import { PictureOutlined } from '@ant-design/icons'
import { BannerManager } from '@/features/admin/content/manage-banners'
import { m } from '@/shared/config/i18n'
import { AdminPageHeader } from '@/shared/ui/admin'
import { HeroSlide } from '@/widgets/common/hero-banner'

const renderPreview = (banner) => <HeroSlide banner={banner} eager />

export default function Banners() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <AdminPageHeader
        eyebrow={m.admin_banner_page_eyebrow()}
        title={m.admin_banner_page_title()}
        description={m.admin_banner_page_description()}
        icon={<PictureOutlined />}
      />
      <BannerManager renderPreview={renderPreview} />
    </div>
  )
}
