import { Form, Input } from 'antd'
import { parseCompanyVideoUrl } from '@/entities/company/company'
import { m } from '@/shared/config/i18n'
import RichTextEditor from '@/shared/ui/rich-text/RichTextEditor'
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
      title={m.employer_company_hero_title()}
      description={m.employer_company_hero_description()}
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
          <Form.Item name="headline" label={m.employer_company_hero_headline()}>
            <Input maxLength={page.registry.limits?.headline ?? 160} showCount placeholder={m.employer_company_hero_headline_placeholder()} />
          </Form.Item>
          <div className="company-content-media-row">
            <Form.Item name="logo_file" label="Logo">
              <ImageField label="Logo" currentUrl={form.pending?.logo_url || form.published.logo_url} disabled={locked} />
            </Form.Item>
            <Form.Item name="cover_file" label={m.employer_company_cover()} className="company-content-media-row__wide">
              <ImageField label={m.employer_company_cover()} wide currentUrl={form.pending?.cover_image_url || form.published.cover_image_url} disabled={locked} />
            </Form.Item>
          </div>
        </>
      )}
    </ContentCard>
  )
}

const RICH_TEXT_CARDS = {
  about: { field: 'description', title: m.employer_company_about_title(), label: m.employer_company_about_label() },
  culture: { field: 'culture', title: m.employer_company_culture_title(), label: m.employer_company_culture_label() },
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
          <RichTextEditor maxLength={10000} disabled={locked} placeholder={m.employer_company_rich_text_placeholder({ label: label.toLowerCase() })} />
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
      title={m.employer_company_gallery_title()}
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
        <Form.Item name="gallery" label={m.employer_company_gallery_label()}>
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
    : Promise.reject(new Error(m.employer_company_video_invalid()))
}

function VideoHint({ form }) {
  const video = parseCompanyVideoUrl(Form.useWatch('video_url', form))
  return video ? <p className="company-content-hint" role="status">{m.employer_company_video_hint({ provider: PROVIDER_LABELS[video.provider], id: video.video_id })}</p> : null
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
          <Form.Item name="video_url" label={m.employer_company_video_label()} rules={[{ validator: videoRule }]}>
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
      title={m.employer_company_social_title()}
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
            rules={[{ pattern: HTTP_URL, message: m.employer_company_social_url_invalid() }]}
          >
            <Input inputMode="url" maxLength={300} placeholder={network.placeholder} />
          </Form.Item>
        ))}
      </div>
    </ContentCard>
  )
}
