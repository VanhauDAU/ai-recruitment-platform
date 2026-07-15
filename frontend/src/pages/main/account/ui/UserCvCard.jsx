import {
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EllipsisOutlined,
  ShareAltOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons'
import { Dropdown, Input, Modal, Spin } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CvDocumentPreview, getCvOwnerView } from '@/entities/cv'
import { usePreviewFitZoom } from '@/shared/hooks/use-preview-fit-zoom'
import { useCvCardActions } from '../model/use-cv-card-actions'

export default function UserCvCard({ cv, onRefresh }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const actions = useCvCardActions(cv, onRefresh)
  const { setIsMainCv } = actions

  // Quản lý trạng thái hover và mở menu của thẻ CV
  const [hovered, setHovered] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const { containerRef: previewWrapRef, zoom: previewZoom } = usePreviewFitZoom(!loading && Boolean(detail))

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getCvOwnerView(cv.public_id)
      .then((data) => {
        if (!cancelled) {
          setDetail(data)
          setIsMainCv(data.cv?.is_default || false)
        }
      })
      .catch(() => {
        if (!cancelled) setDetail(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cv.public_id, setIsMainCv])

  const version = detail?.version
  const documentData = useMemo(() => {
    if (!version) return null
    return {
      schema_version: version.schema_version,
      content_json: version.content_json,
      layout_json: version.layout_json,
      style_json: version.style_json,
    }
  }, [version])

  const handleDownload = () => {
    window.open(`/cvs/${cv.public_id}/view`, '_blank', 'noopener,noreferrer')
  }

  const dropdownMenuItems = [
    {
      key: 'copy-link',
      label: 'Sao chép liên kết',
      icon: <CopyOutlined />,
      onClick: actions.copyLink,
    },
    {
      key: 'share-fb',
      label: 'Chia sẻ trên Facebook',
      icon: <ShareAltOutlined />,
      onClick: actions.shareFacebook,
    },
    {
      type: 'divider',
    },
    ...(cv.cv_type === 'builder' ? [{
      key: 'duplicate',
      label: 'Tạo bản sao',
      icon: <CopyOutlined />,
      onClick: actions.duplicate,
    }] : []),
    {
      key: 'rename',
      label: 'Đổi tên',
      icon: <EditOutlined />,
      onClick: actions.rename.show,
    },
    {
      key: 'delete',
      label: 'Xoá',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: actions.confirmDelete,
    },
  ]

  // Mở CV ở tab mới khi click vào card
  const handleCardClick = () => {
    if (!loading && documentData) {
      window.open(`/cvs/${cv.public_id}/view`, '_blank')
    }
  }

  const formattedDate = cv.updated_at
    ? new Date(cv.updated_at).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).replace(/\//g, '-')
    : '15-07-2026'

  // Ngôi sao hiển thị khi là CV chính HOẶC khi đang hover thẻ HOẶC khi đang mở menu
  const showStar = actions.isMainCv || hovered || isMenuOpen

  return (
    <div className="flex flex-col space-y-3">
      {/* Viewport xem trước CV */}
      <div
        ref={previewWrapRef}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false)
          setIsMenuOpen(false)
        }}
        onClick={handleCardClick}
        className="group relative aspect-[3/4] w-full overflow-hidden flex justify-center cursor-pointer"
      >
        {/* Ngôi sao CV chính ở góc trên bên phải - Ẩn mặc định, hiện khi hover hoặc khi là CV chính */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            actions.toggleMain()
          }}
          className={[
            'absolute top-3.5 right-3.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm border border-slate-100 transition-all duration-200 cursor-pointer',
            showStar ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none',
          ].join(' ')}
          style={{ backgroundColor: '#ffffff' }}
          title={actions.isMainCv ? 'CV chính' : 'Đặt làm CV chính'}
        >
          {actions.isMainCv ? (
            <StarFilled className="text-lg text-yellow-500" />
          ) : (
            <StarOutlined className="text-lg text-slate-400 hover:text-yellow-500 transition-colors" />
          )}
        </button>

        {loading ? (
          <div className="flex items-center justify-center h-full w-full">
            <Spin size="small" />
          </div>
        ) : !documentData ? (
          <div className="flex flex-col items-center justify-center text-center p-4">
            <span className="text-xs font-semibold text-slate-400">Không có bản xem trước</span>
          </div>
        ) : (
          <div className="origin-top h-fit" style={{ zoom: previewZoom }}>
            <div className="shadow-[0_4px_16px_rgba(0,0,0,0.06)] rounded bg-white overflow-hidden pointer-events-none">
              <CvDocumentPreview document={documentData} rendererKey={version.template_renderer_key} />
            </div>
          </div>
        )}

        {/* Hover overlay với nút thao tác nằm ở GÓC DƯỚI GIỮA, giữ trạng thái hiển thị khi mở menu */}
        {!loading && (
          <div
            onClick={handleCardClick}
            className={[
              'absolute inset-0 bg-gradient-to-t from-black/45 via-black/15 to-transparent flex items-end justify-center pb-5 transition-opacity duration-200',
              (hovered || isMenuOpen) ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
            ].join(' ')}
          >
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDownload()
                }}
                className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold text-black hover:text-[#00b14f] transition shadow-sm cursor-pointer border border-slate-100 hover:scale-105"
                style={{ backgroundColor: '#ffffff' }}
              >
                <DownloadOutlined /> Xem / xuất PDF
              </button>
              <Link
                to={`/cvs/${cv.public_id}/edit`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold text-black hover:text-[#00b14f] transition shadow-sm cursor-pointer border border-slate-100 hover:scale-105"
                style={{ backgroundColor: '#ffffff' }}
              >
                <EditOutlined /> Chỉnh sửa
              </Link>
              <Dropdown
                menu={{ items: dropdownMenuItems }}
                trigger={['click']}
                placement="bottomRight"
                open={isMenuOpen}
                onOpenChange={(open) => setIsMenuOpen(open)}
              >
                <button
                  type="button"
                  aria-label="Thao tác CV"
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-black hover:text-[#00b14f] transition shadow-sm cursor-pointer border border-slate-100 hover:scale-105"
                  style={{ backgroundColor: '#ffffff' }}
                >
                  <EllipsisOutlined className="text-base" />
                </button>
              </Dropdown>
            </div>
          </div>
        )}
      </div>

      {/* Thông tin tiêu đề */}
      <div className="space-y-1 px-0.5">
        <h4 className="truncate text-sm font-bold text-slate-800">
          {actions.title}
        </h4>
        <p className="text-xs text-slate-400">
          Cập nhật {formattedDate}
        </p>
      </div>

      {/* Modal Rename */}
      <Modal
        title="Đổi tên CV"
        open={actions.rename.open}
        onOk={actions.rename.submit}
        onCancel={actions.rename.close}
        okText="Lưu lại"
        cancelText="Hủy"
        destroyOnHidden
      >
        <div className="py-2.5">
          <p className="mb-2 text-xs font-semibold text-slate-500">Tên CV mới</p>
          <Input
            value={actions.rename.value}
            onChange={(e) => actions.rename.setValue(e.target.value)}
            placeholder="Nhập tên CV..."
            onPressEnter={actions.rename.submit}
            maxLength={255}
          />
        </div>
      </Modal>
    </div>
  )
}
