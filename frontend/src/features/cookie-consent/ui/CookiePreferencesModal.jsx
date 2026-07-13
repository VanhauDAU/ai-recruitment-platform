import { CheckCircleFilled, CloseOutlined } from '@ant-design/icons'
import { Button, Modal, Switch } from 'antd'
import { useEffect, useState } from 'react'
import { EMPTY_CONSENT } from '@/entities/consent'

const GROUPS = [
  {
    key: 'necessary',
    title: 'Cookie thiết yếu',
    description: 'Giúp website vận hành an toàn, duy trì phiên và ghi nhớ lựa chọn cookie của bạn.',
    locked: true,
  },
  {
    key: 'preferences',
    title: 'Cookie tùy chọn',
    description: 'Ghi nhớ giao diện và lịch sử tìm kiếm để trải nghiệm phù hợp hơn ở lần sau.',
  },
  {
    key: 'analytics',
    title: 'Cookie hiệu năng',
    description: 'Đo lường cách website được sử dụng, gồm lượt xem tin tuyển dụng, để cải thiện sản phẩm.',
  },
  {
    key: 'marketing',
    title: 'Cookie quảng cáo',
    description: 'Dành cho nội dung, quảng cáo và tái tiếp thị phù hợp. Hiện chưa tích hợp đối tác quảng cáo.',
  },
]

function CookieGroup({ group, checked, onChange }) {
  return (
    <article className="rounded-xl bg-slate-50 px-4 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-bold text-slate-700">{group.title}</h3>
        {group.locked ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircleFilled /> Luôn hoạt động</span>
        ) : (
          <Switch checked={checked} onChange={onChange} checkedChildren="Bật" unCheckedChildren="Tắt" aria-label={`${group.title}: ${checked ? 'bật' : 'tắt'}`} />
        )}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-600">{group.description}</p>
    </article>
  )
}

export default function CookiePreferencesModal({ open, consent, onClose, onSave, saving }) {
  const [draft, setDraft] = useState(EMPTY_CONSENT)

  useEffect(() => {
    if (open) setDraft({ ...EMPTY_CONSENT, ...consent })
  }, [consent, open])

  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }))
  const save = (next) => onSave(next || draft)
  const acceptAll = () => save({ necessary: true, preferences: true, analytics: true, marketing: true })

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={620}
      destroyOnHidden
      className="cookie-preferences-modal"
      aria-labelledby="cookie-preferences-title"
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <header className="flex items-start justify-between gap-5 border-b border-slate-100 px-1 pb-4">
          <div>
            <h2 id="cookie-preferences-title" className="text-lg font-bold text-slate-800">Cài đặt cookie</h2>
            <p className="mt-2 text-sm leading-5 text-slate-600">Bạn có thể chọn các nhóm cookie tùy chọn. Cookie thiết yếu luôn được bật để website hoạt động.</p>
          </div>
          <Button type="text" shape="circle" icon={<CloseOutlined />} onClick={onClose} aria-label="Đóng cài đặt cookie" />
        </header>

        <div className="space-y-2.5 overflow-y-auto py-4">
          {GROUPS.map((group) => (
            <CookieGroup
              key={group.key}
              group={group}
              checked={draft[group.key]}
              onChange={(checked) => update(group.key, checked)}
            />
          ))}
          <p className="px-1 text-xs leading-5 text-slate-500">Bạn có thể thay đổi hoặc rút lại lựa chọn bất cứ lúc nào trong phần chân trang. Xem <a className="font-semibold text-[var(--brand-primary)] underline" href="/chinh-sach-cookie">Chính sách cookie</a>.</p>
        </div>

        <footer className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <Button size="large" onClick={() => save()} loading={saving} className="!border-[var(--brand-primary)] !font-semibold !text-[var(--brand-primary)]">
            Xác nhận lựa chọn
          </Button>
          <Button type="primary" size="large" onClick={acceptAll} loading={saving} className="!font-semibold">
            Chấp nhận tất cả
          </Button>
        </footer>
      </div>
    </Modal>
  )
}
