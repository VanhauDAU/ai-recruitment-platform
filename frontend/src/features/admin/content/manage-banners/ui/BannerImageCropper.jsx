import { ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons'
import { Button, Modal, Slider } from 'antd'
import { useState } from 'react'
import Cropper from 'react-easy-crop'
import { m } from '@/shared/config/i18n'

const MIN_ZOOM = 1
const MAX_ZOOM = 3

/** Hộp cắt ảnh khóa tỉ lệ: kéo để căn vị trí, cuộn hoặc thanh trượt để phóng to. */
export default function BannerImageCropper({ source, aspect, recommendedWidth, busy, onCancel, onConfirm }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [area, setArea] = useState(null)
  const tooSmall = area && area.width < recommendedWidth

  return (
    <Modal
      open={Boolean(source)}
      title={m.admin_banner_crop_title()}
      width={760}
      onCancel={onCancel}
      destroyOnHidden
      footer={[
        <Button key="reset" onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(MIN_ZOOM) }}>{m.admin_banner_crop_reset()}</Button>,
        <Button key="cancel" onClick={onCancel}>{m.admin_banner_crop_cancel()}</Button>,
        <Button key="ok" type="primary" loading={busy} disabled={!area} onClick={() => onConfirm(area)}>
          {m.admin_banner_crop_confirm()}
        </Button>,
      ]}
    >
      <div className="relative h-72 overflow-hidden rounded-md bg-slate-900 sm:h-96">
        {source && (
          <Cropper
            image={source}
            crop={crop}
            zoom={zoom}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            aspect={aspect}
            showGrid
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
          />
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <ZoomOutOutlined className="text-slate-500" />
        <Slider
          className="flex-1"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={setZoom}
          tooltip={{ formatter: (value) => `${Math.round(value * 100)}%` }}
          aria-label={m.admin_banner_crop_zoom()}
        />
        <ZoomInOutlined className="text-slate-500" />
      </div>
      <p className={`text-xs ${tooSmall ? 'text-amber-600' : 'text-slate-500'}`}>
        {area && m.admin_banner_crop_size({ width: Math.round(area.width), height: Math.round(area.height) })}
        {tooSmall ? ` · ${m.admin_banner_crop_small({ width: recommendedWidth })}` : ''}
      </p>
    </Modal>
  )
}
