import { Form, Input } from 'antd'
import { parseCompanyVideoUrl } from '@/entities/company'
import RichTextEditor from '@/shared/ui/RichTextEditor'
import { cardStatus, changedFields, contentValue } from '../model/content-form'
import ContentCard from './ContentCard'
import { GalleryField, ImageField } from './ImageFields'

const HTTP_URL = /^https?:\/\/\S+$/i
const PROVIDER_LABELS = { youtube: 'YouTube', vimeo: 'Vimeo' }

const MEDIA_ERROR_FIELDS = { logo_pending: 'logo_file', logo: 'logo_file', cover_pending: 'cover_file', cover: 'cover_file' }

export function HeroCard({ page, readOnly }) {
  const form = page.content_form
  const headline = contentValue(form, 'headline') || ''
  return (
    <ContentCard
      card="hero"
      title="Đầu trang"
      description="Khẩu hiệu hiển thị dưới tên công ty; logo và ảnh bìa mới cũng cần được duyệt."
      {...cardStatus(page, 'hero')}
      readOnly={readOnly}
      initialValues={{ headline, logo_file: null, cover_file: null }}
      errorName={([field, ...rest]) => [MEDIA_ERROR_FIELDS[field] || field, ...rest]}
      toSubmission={(values) => ({
        changes: changedFields({ headline: (values.headline || '').trim() }, { headline }),
        files: { logo: values.logo_file, cover: values.cover_file },
      })}
    >
      {({ readOnly: locked }) => (
        <>
          <Form.Item name="headline" label="Khẩu hiệu">
            <Input maxLength={page.registry.limits?.headline ?? 160} showCount placeholder="Ví dụ: Cùng xây phần mềm cho hàng triệu người dùng" />
          </Form.Item>
          <div className="company-content-media-row">
            <Form.Item name="logo_file" label="Logo">
              <ImageField label="Logo" currentUrl={form.pending?.logo_url || form.published.logo_url} disabled={locked} />
            </Form.Item>
            <Form.Item name="cover_file" label="Ảnh bìa" className="company-content-media-row__wide">
              <ImageField label="Ảnh bìa" wide currentUrl={form.pending?.cover_image_url || form.published.cover_image_url} disabled={locked} />
            </Form.Item>
          </div>
        </>
      )}
    </ContentCard>
  )
}

const RICH_TEXT_CARDS = {
  about: { field: 'description', title: 'Giới thiệu', label: 'Giới thiệu công ty' },
  culture: { field: 'culture', title: 'Văn hoá', label: 'Văn hoá công ty' },
}

export function RichTextCard({ page, card, readOnly }) {
  const { field, title, label } = RICH_TEXT_CARDS[card]
  const initial = contentValue(page.content_form, field) || ''
  return (
    <ContentCard
      card={card}
      title={title}
      {...cardStatus(page, card)}
      readOnly={readOnly}
      initialValues={{ [field]: initial }}
      toSubmission={(values) => ({ changes: changedFields({ [field]: values[field] || '' }, { [field]: initial }) })}
    >
      {({ readOnly: locked }) => (
        <Form.Item name={field} label={label}>
          <RichTextEditor maxLength={10000} disabled={locked} placeholder={`Nhập ${label.toLowerCase()}`} />
        </Form.Item>
      )}
    </ContentCard>
  )
}

export function GalleryCard({ page, readOnly }) {
  const form = page.content_form
  const deletions = form.pending?.gallery_deletions || []
  return (
    <ContentCard
      card="gallery"
      title="Thư viện ảnh"
      {...cardStatus(page, 'gallery')}
      readOnly={readOnly}
      initialValues={{ gallery: { deletions, files: [] } }}
      errorName={([field, ...rest]) => (['gallery_deletions', 'gallery_pending', 'gallery'].includes(field) ? ['gallery'] : [field, ...rest])}
      toSubmission={({ gallery }) => ({
        changes: changedFields({ gallery_deletions: gallery.deletions }, { gallery_deletions: deletions }),
        files: { gallery: gallery.files },
      })}
    >
      {({ readOnly: locked }) => (
        <Form.Item name="gallery" label="Ảnh văn phòng, đội ngũ, hoạt động">
          <GalleryField
            published={form.published.gallery || []}
            additions={form.pending?.gallery_additions || []}
            limit={page.registry.limits?.gallery ?? 10}
            disabled={locked}
          />
        </Form.Item>
      )}
    </ContentCard>
  )
}

function videoRule(_, value) {
  return !value?.trim() || parseCompanyVideoUrl(value)
    ? Promise.resolve()
    : Promise.reject(new Error('Chỉ hỗ trợ liên kết video YouTube hoặc Vimeo.'))
}

function VideoHint({ form }) {
  const video = parseCompanyVideoUrl(Form.useWatch('video_url', form))
  return video ? <p className="company-content-hint" role="status">Video {PROVIDER_LABELS[video.provider]}, mã {video.video_id}.</p> : null
}

export function VideoCard({ page, readOnly }) {
  const initial = contentValue(page.content_form, 'video_url') || ''
  return (
    <ContentCard
      card="video"
      title="Video"
      {...cardStatus(page, 'video')}
      readOnly={readOnly}
      initialValues={{ video_url: initial }}
      toSubmission={(values) => ({ changes: changedFields({ video_url: (values.video_url || '').trim() }, { video_url: initial }) })}
    >
      {({ form }) => (
        <>
          <Form.Item name="video_url" label="Liên kết video giới thiệu" rules={[{ validator: videoRule }]}>
            <Input inputMode="url" maxLength={300} placeholder="https://www.youtube.com/watch?v=…" />
          </Form.Item>
          <VideoHint form={form} />
        </>
      )}
    </ContentCard>
  )
}

export function SocialLinksCard({ page, readOnly }) {
  const networks = page.registry.social_networks || []
  const saved = contentValue(page.content_form, 'social_links') || {}
  const initial = Object.fromEntries(networks.map(({ key }) => [key, saved[key] || '']))
  return (
    <ContentCard
      card="social_links"
      title="Mạng xã hội"
      {...cardStatus(page, 'social_links')}
      readOnly={readOnly}
      initialValues={{ social_links: initial }}
      toSubmission={(values) => {
        const links = Object.fromEntries(networks.map(({ key }) => [key, (values.social_links?.[key] || '').trim()]))
        return { changes: changedFields({ social_links: links }, { social_links: initial }) }
      }}
    >
      <div className="company-content-grid">
        {networks.map((network) => (
          <Form.Item
            key={network.key}
            name={['social_links', network.key]}
            label={network.label}
            rules={[{ pattern: HTTP_URL, message: 'Nhập liên kết bắt đầu bằng https://' }]}
          >
            <Input inputMode="url" maxLength={300} placeholder={network.placeholder} />
          </Form.Item>
        ))}
      </div>
    </ContentCard>
  )
}
