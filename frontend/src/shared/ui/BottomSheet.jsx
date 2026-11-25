import { CloseOutlined } from '@ant-design/icons'
import { Drawer } from 'antd'
import { m } from '@/shared/config/i18n'

const SHEET_RADIUS = '20px 20px 0 0'

/** Tấm trượt từ đáy cho màn hẹp: bo góc trên, có thanh kéo, cao theo nội dung. */
export default function BottomSheet({ open, onClose, title, extra, footer, children, closeLabel = m.ui_sheet_close() }) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="bottom"
      size="auto"
      closable={false}
      title={(
        <>
          <span aria-hidden className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-200" />
          {title}
        </>
      )}
      extra={(
        <div className="flex items-center gap-1">
          {extra}
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
          >
            <CloseOutlined />
          </button>
        </div>
      )}
      footer={footer}
      styles={{
        wrapper: { maxHeight: '85dvh', borderRadius: SHEET_RADIUS, overflow: 'hidden' },
        section: { borderRadius: SHEET_RADIUS },
        header: { position: 'relative', padding: '20px 12px 10px 16px' },
        body: { padding: 0, paddingBottom: footer ? 0 : 'env(safe-area-inset-bottom, 0px)' },
        footer: { padding: '10px 16px calc(10px + env(safe-area-inset-bottom, 0px))' },
      }}
    >
      {children}
    </Drawer>
  )
}
