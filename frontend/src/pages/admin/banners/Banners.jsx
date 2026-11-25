import { BannerManager } from '@/features/admin/content/manage-banners'
import { HeroSlide } from '@/widgets/common/hero-banner'

const renderPreview = (banner) => <HeroSlide banner={banner} eager />

export default function Banners() {
  return (
    <div className="space-y-4">
      <BannerManager renderPreview={renderPreview} />
    </div>
  )
}
