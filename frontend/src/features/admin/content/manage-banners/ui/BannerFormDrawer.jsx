import { useMutation } from '@tanstack/react-query'
import { Button, DatePicker, Drawer, Form, Input, Segmented, Switch } from 'antd'
import { useEffect, useState } from 'react'
import {
  BANNER_KIND_LABELS,
  BANNER_KINDS,
  BANNER_THEMES,
  HOME_HERO_PLACEMENT,
  createAdminBanner,
  updateAdminBanner,
} from '@/entities/content/banner'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import { apiFieldErrors, bannerFormValues, bannerPayload, emptyBannerValues, previewBanner } from '../model/banner-form'
import BannerImageField from './BannerImageField'
import CompanySelect from './CompanySelect'

const THEME_LABELS = {
  green: () => m.admin_banner_theme_green(),
  blue: () => m.admin_banner_theme_blue(),
  orange: () => m.admin_banner_theme_orange(),
}

const KIND_HELP = {
  image: () => m.admin_banner_kind_help_image(),
  promo: () => m.admin_banner_kind_help_promo(),
  company: () => m.admin_banner_kind_help_company(),
  ai: () => m.admin_banner_kind_help_ai(),
}

function Preview({ renderPreview, banner }) {
  return (
    <div className="mb-4 space-y-2 rounded-lg bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-500">{m.admin_banner_preview()}</p>
      {/* Chỉ xem trước bố cục máy tính: breakpoint theo viewport nên khung thu nhỏ không mô phỏng được điện thoại. */}
      <div className="aspect-[8/3] pointer-events-none">{renderPreview(banner)}</div>
    </div>
  )
}

/**
 * Drawer tạo/sửa banner. `banner` là bản ghi đang sửa, hoặc `{ placement }` khi tạo mới.
 * `renderPreview(banner)` do page truyền vào để xem trước bằng đúng slide của trang chủ.
 */
export default function BannerFormDrawer({ banner, onClose, onSaved, renderPreview }) {
  const [form] = Form.useForm()
  const editing = Boolean(banner?.id)
  const [company, setCompany] = useState(null)
  const values = Form.useWatch([], form) || {}
  const placement = Form.useWatch('placement', form) || banner?.placement
  const kind = Form.useWatch('kind', form)
  const isHero = placement === HOME_HERO_PLACEMENT

  useEffect(() => {
    if (!banner) return
    form.resetFields()
    form.setFieldsValue(editing ? bannerFormValues(banner) : emptyBannerValues(banner.placement))
    setCompany(banner.company || null)
  }, [banner, editing, form])

  const save = useMutation({
    mutationFn: (formValues) => {
      const payload = bannerPayload(formValues)
      return editing ? updateAdminBanner(banner.id, payload) : createAdminBanner(payload)
    },
    onSuccess: () => {
      message.success(editing ? m.admin_banner_saved() : m.admin_banner_created())
      onSaved()
    },
    onError: (error) => {
      const fields = apiFieldErrors(error)
      if (fields.length) form.setFields(fields)
      message.error(getApiErrorMessage(error, m.admin_banner_save_failed()))
    },
  })

  const needsText = kind !== 'image'
  const imageHint = kind === 'image' && isHero ? m.admin_banner_image_hint_hero() : m.admin_banner_image_hint_promo()

  return (
    <Drawer
      open={Boolean(banner)}
      width={720}
      title={editing ? m.admin_banner_edit_title() : m.admin_banner_create_title()}
      onClose={onClose}
      destroyOnHidden
      extra={(
        <Button type="primary" loading={save.isPending} onClick={() => form.submit()}>
          {editing ? m.admin_banner_save() : m.admin_banner_create()}
        </Button>
      )}
    >
      {isHero && renderPreview && <Preview renderPreview={renderPreview} banner={previewBanner(values, company)} />}
      <Form form={form} layout="vertical" requiredMark={false} onFinish={(formValues) => save.mutate(formValues)}>
        <Form.Item name="placement" hidden><Input /></Form.Item>
        <Form.Item name="image_preview" hidden><Input /></Form.Item>
        {isHero && (
          <Form.Item name="kind" label={m.admin_banner_kind()}>
            <Segmented block options={BANNER_KINDS.map((value) => ({ value, label: BANNER_KIND_LABELS[value]() }))} />
          </Form.Item>
        )}
        {isHero && <p className="-mt-3 mb-4 text-xs text-slate-500">{KIND_HELP[kind || 'image']()}</p>}

        {(kind === 'company' || kind === 'image') && isHero && (
          <Form.Item
            name="company"
            label={kind === 'company' ? m.admin_banner_company() : m.admin_banner_company_optional()}
            extra={kind === 'image' ? m.admin_banner_company_link_help() : null}
          >
            <CompanySelect initialCompany={company} onCompany={setCompany} />
          </Form.Item>
        )}

        <Form.Item
          name="title"
          label={kind === 'image' ? m.admin_banner_name() : kind === 'company' ? m.admin_banner_title_override() : m.admin_banner_title()}
          extra={kind === 'image' ? m.admin_banner_name_help() : m.admin_banner_title_help()}
        >
          <Input maxLength={200} showCount />
        </Form.Item>

        {(kind === 'image' || kind === 'promo' || !isHero) && (
          <Form.Item name="image_path" label={m.admin_banner_image()}>
            <BannerImageField form={form} placement={placement} kind={kind} hint={imageHint} />
          </Form.Item>
        )}

        {needsText && (
          <>
            <Form.Item name="eyebrow" label={m.admin_banner_eyebrow()}>
              <Input maxLength={100} placeholder={m.admin_banner_eyebrow_placeholder()} />
            </Form.Item>
            <Form.Item name="subtitle" label={m.admin_banner_subtitle()}>
              <Input.TextArea rows={2} maxLength={300} showCount />
            </Form.Item>
            <Form.Item name="theme" label={m.admin_banner_theme()}>
              <Segmented options={Object.keys(BANNER_THEMES).map((value) => ({ value, label: THEME_LABELS[value]() }))} />
            </Form.Item>
          </>
        )}

        <div className="grid gap-x-4 sm:grid-cols-2">
          {kind !== 'image' && (
            <Form.Item name="cta_label" label={kind === 'company' ? m.admin_banner_cta_label_company() : m.admin_banner_cta_label()}>
              <Input maxLength={100} />
            </Form.Item>
          )}
          <Form.Item
            name="cta_url"
            label={kind === 'image' ? m.admin_banner_link() : m.admin_banner_cta_url()}
            extra={m.admin_banner_url_help()}
            className={kind === 'image' ? 'sm:col-span-2' : undefined}
          >
            <Input maxLength={300} placeholder="/viec-lam?search=IT" />
          </Form.Item>
        </div>
        {!isHero && (
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Form.Item name="cta_secondary_label" label={m.admin_banner_cta_secondary_label()}>
              <Input maxLength={100} />
            </Form.Item>
            <Form.Item name="cta_secondary_url" label={m.admin_banner_cta_secondary_url()}>
              <Input maxLength={300} />
            </Form.Item>
          </div>
        )}

        <Form.Item name="schedule" label={m.admin_banner_schedule()} extra={m.admin_banner_schedule_help()}>
          <DatePicker.RangePicker showTime={{ format: 'HH:mm' }} format="DD/MM/YYYY HH:mm" allowEmpty={[true, true]} className="w-full" />
        </Form.Item>
        <Form.Item name="is_active" label={m.admin_banner_active()} valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Drawer>
  )
}
