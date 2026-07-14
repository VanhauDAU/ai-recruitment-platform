import {
  CloudUploadOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EllipsisOutlined,
  FileAddOutlined,
  InboxOutlined,
  ShareAltOutlined,
  StarFilled,
  StarOutlined,
  UndoOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { Dropdown, Input, Modal, Spin, message } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  createCvSharedLink,
  CvDocumentPreview,
  deleteCv,
  duplicateCv,
  getArchivedCvs,
  getCvOwnerView,
  getMyCvs,
  importCvFile,
  renameCv,
  restoreCv,
  setDefaultCv,
} from '@/entities/cv'
import { useSiteSettings } from '@/entities/site-settings'

function UserCvCard({ cv, onRefresh }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isMainCv, setIsMainCv] = useState(cv.is_default || false)
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [title, setTitle] = useState(cv.title || '')
  const [newTitle, setNewTitle] = useState(cv.title || '')
  const previewWrapRef = useRef(null)
  const [previewZoom, setPreviewZoom] = useState(0.35)

  // Quản lý trạng thái hover và mở menu của thẻ CV
  const [hovered, setHovered] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

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
  }, [cv.public_id])

  useEffect(() => {
    setIsMainCv(cv.is_default || false)
    setTitle(cv.title || '')
    setNewTitle(cv.title || '')
  }, [cv])

  useEffect(() => {
    if (loading || !detail) return undefined
    const element = previewWrapRef.current
    if (!element) return undefined
    const fit = () => {
      setPreviewZoom(element.clientWidth / 842)
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    return () => observer.disconnect()
  }, [loading, detail])

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

  const handleToggleMain = async () => {
    const nextState = !isMainCv
    try {
      await setDefaultCv(cv.public_id, nextState)
      setIsMainCv(nextState)
      message.success(nextState ? 'Đã đặt CV này làm CV chính.' : 'Đã bỏ đặt CV này làm CV chính.')
      onRefresh?.()
    } catch {
      message.error('Không thể cập nhật trạng thái CV chính.')
    }
  }

  const handleDownload = () => {
    window.open(`/cvs/${cv.public_id}/view`, '_blank', 'noopener,noreferrer')
  }

  const handleCopyLink = async () => {
    try {
      const { token } = await createCvSharedLink(cv.public_id)
      const shareUrl = `${window.location.origin}/cv/share/${token}`
      await navigator.clipboard.writeText(shareUrl)
      message.success('Đã sao chép liên kết chia sẻ CV.')
    } catch {
      message.error('Không thể tạo liên kết chia sẻ.')
    }
  }

  const handleShareFacebook = async () => {
    try {
      const { token } = await createCvSharedLink(cv.public_id)
      const shareUrl = `${window.location.origin}/cv/share/${token}`
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener,noreferrer')
    } catch {
      message.error('Không thể tạo liên kết chia sẻ.')
    }
  }

  const handleDuplicate = async () => {
    try {
      await duplicateCv(cv.public_id, `${title} (Bản sao)`)
      message.success('Tạo bản sao CV thành công.')
      onRefresh?.()
    } catch {
      message.error('Không thể tạo bản sao CV.')
    }
  }

  const handleRenameClick = () => {
    setNewTitle(title)
    setIsRenameOpen(true)
  }

  const handleRenameSubmit = async () => {
    if (!newTitle.trim()) {
      message.warning('Vui lòng nhập tên CV.')
      return
    }
    try {
      const updated = await renameCv(cv.public_id, newTitle.trim())
      setTitle(updated.title)
      message.success('Đổi tên CV thành công.')
      setIsRenameOpen(false)
      onRefresh?.()
    } catch {
      message.error('Không thể đổi tên CV.')
    }
  }

  const handleDelete = () => {
    Modal.confirm({
      title: 'Xóa CV của bạn?',
      content: 'Hành động này sẽ đưa CV vào kho lưu trữ và không thể hoàn tác.',
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await deleteCv(cv.public_id)
          message.success('Đã đưa CV vào kho lưu trữ.')
          onRefresh?.()
        } catch {
          message.error('Không thể lưu trữ CV.')
        }
      },
    })
  }

  const dropdownMenuItems = [
    {
      key: 'copy-link',
      label: 'Sao chép liên kết',
      icon: <CopyOutlined />,
      onClick: handleCopyLink,
    },
    {
      key: 'share-fb',
      label: 'Chia sẻ trên Facebook',
      icon: <ShareAltOutlined />,
      onClick: handleShareFacebook,
    },
    {
      type: 'divider',
    },
    ...(cv.cv_type === 'builder' ? [{
      key: 'duplicate',
      label: 'Tạo bản sao',
      icon: <CopyOutlined />,
      onClick: handleDuplicate,
    }] : []),
    {
      key: 'rename',
      label: 'Đổi tên',
      icon: <EditOutlined />,
      onClick: handleRenameClick,
    },
    {
      key: 'delete',
      label: 'Xoá',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: handleDelete,
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
  const showStar = isMainCv || hovered || isMenuOpen

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
            handleToggleMain()
          }}
          className={[
            'absolute top-3.5 right-3.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm border border-slate-100 transition-all duration-200 cursor-pointer',
            showStar ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none',
          ].join(' ')}
          style={{ backgroundColor: '#ffffff' }}
          title={isMainCv ? 'CV chính' : 'Đặt làm CV chính'}
        >
          {isMainCv ? (
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
          {title}
        </h4>
        <p className="text-xs text-slate-400">
          Cập nhật {formattedDate}
        </p>
      </div>

      {/* Modal Rename */}
      <Modal
        title="Đổi tên CV"
        open={isRenameOpen}
        onOk={handleRenameSubmit}
        onCancel={() => setIsRenameOpen(false)}
        okText="Lưu lại"
        cancelText="Hủy"
        destroyOnHidden
      >
        <div className="py-2.5">
          <p className="mb-2 text-xs font-semibold text-slate-500">Tên CV mới</p>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Nhập tên CV..."
            onPressEnter={handleRenameSubmit}
            maxLength={255}
          />
        </div>
      </Modal>
    </div>
  )
}

function ArchivedCvCard({ cv, onRefresh }) {
  const [restoring, setRestoring] = useState(false)
  const archivedDate = cv.archived_at
    ? new Date(cv.archived_at).toLocaleDateString('vi-VN')
    : 'gần đây'

  const handleRestore = async () => {
    setRestoring(true)
    try {
      await restoreCv(cv.public_id)
      message.success('Đã khôi phục CV. CV sẽ không tự trở thành CV mặc định.')
      onRefresh?.()
    } catch (error) {
      const detail = error?.response?.data?.detail
      message.error(detail || 'Không thể khôi phục CV này.')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <article className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="min-w-0">
        <h4 className="truncate text-sm font-bold text-slate-800">{cv.title}</h4>
        <p className="mt-1 text-xs text-slate-500">Đã lưu trữ {archivedDate}</p>
      </div>
      <button
        type="button"
        disabled={restoring}
        onClick={handleRestore}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#00b14f] px-3.5 py-1.5 text-xs font-bold text-[#008a3e] transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <UndoOutlined /> {restoring ? 'Đang khôi phục' : 'Khôi phục'}
      </button>
    </article>
  )
}

export default function MyCvs() {
  const { siteName } = useSiteSettings()
  const navigate = useNavigate()
  const [cvs, setCvs] = useState([])
  const [archivedCvs, setArchivedCvs] = useState([])
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef(null)

  const fetchCvs = () => {
    let cancelled = false
    setLoading(true)
    Promise.all([getMyCvs(), getArchivedCvs()])
      .then(([activeCvs, archived]) => {
        if (!cancelled) setCvs(activeCvs)
        if (!cancelled) setArchivedCvs(archived)
      })
      .catch(() => {
        if (!cancelled) setCvs([])
        if (!cancelled) setArchivedCvs([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }

  useEffect(() => {
    return fetchCvs()
  }, [])

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await importCvFile(file)
      message.success(`Đã tải lên tệp ${file.name} thành công.`)
      fetchCvs()
    } catch {
      message.error('Không thể tải CV lên. Chỉ hỗ trợ tệp PDF hoặc DOCX.')
    } finally {
      e.target.value = ''
    }
  }

  const builderCvs = cvs.filter((cv) => cv.cv_type === 'builder')
  const uploadedCvs = cvs.filter((cv) => cv.cv_type === 'uploaded')

  return (
    <div className="space-y-6">
      {/* Hidden file input for upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,.docx"
        className="hidden"
      />

      {/* Banner Quảng cáo/Thống kê */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0d5c3a] to-[#137a4e] p-6 text-white shadow-md">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:items-center">
          <div className="md:col-span-8 space-y-4">
            <h2 className="text-xl font-bold leading-snug sm:text-2xl">
              Ứng viên được NTD chủ động tiếp cận{' '}
              <span className="text-[#00ff66] font-extrabold underline decoration-2 underline-offset-4">
                tăng 23%
              </span>{' '}
              trong tuần vừa rồi
            </h2>
            <p className="text-sm text-emerald-100 font-medium">
              Cập nhật CV để không bỏ lỡ cơ hội!
            </p>
            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => navigate('/mau-cv')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2.5 text-xs font-bold text-[#0d5c3a] transition-all hover:bg-slate-50 cursor-pointer shadow-sm"
              >
                <FileAddOutlined />
                Tạo CV online +
              </button>
              <button
                type="button"
                onClick={handleUploadClick}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800/80 border border-emerald-700 px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-emerald-950 cursor-pointer"
              >
                <CloudUploadOutlined />
                Tải CV lên
              </button>
            </div>
          </div>

          {/* Cột phải: SVG Biểu đồ tăng trưởng sinh động */}
          <div className="hidden md:col-span-4 md:flex md:justify-end">
            <div className="relative h-24 w-44">
              {/* Chỉ số tăng trưởng */}
              <div className="absolute left-2 top-0 flex items-center gap-1 text-xs font-bold text-[#00ff66]">
                <span className="animate-pulse">↗</span> 23%
              </div>
              <svg className="h-full w-full overflow-visible" viewBox="0 0 160 80">
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00ff66" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#00ff66" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Đường lưới phụ */}
                <line x1="0" y1="70" x2="160" y2="70" stroke="rgba(255,255,255,0.08)" strokeDasharray="3,3" />
                <line x1="0" y1="40" x2="160" y2="40" stroke="rgba(255,255,255,0.08)" strokeDasharray="3,3" />
                {/* Vùng gradient phủ dưới đồ thị */}
                <path
                  d="M 10 60 Q 45 35, 80 50 T 150 15 L 150 75 L 10 75 Z"
                  fill="url(#chartGrad)"
                />
                {/* Đường vẽ chính */}
                <path
                  d="M 10 60 Q 45 35, 80 50 T 150 15"
                  fill="none"
                  stroke="#00ff66"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                {/* Điểm nhấn & Ripple */}
                <circle cx="150" cy="15" r="4.5" fill="#00ff66" />
                <circle cx="150" cy="15" r="10" fill="none" stroke="#00ff66" strokeWidth="1.5" className="animate-ping opacity-60" style={{ transformOrigin: '150px 15px' }} />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* CV đã tạo trên platform */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800 sm:text-[17px]">
            CV đã tạo trên {siteName}
          </h3>
          <button
            type="button"
            onClick={() => navigate('/mau-cv')}
            className="inline-flex items-center gap-1 rounded-full bg-[#00b14f] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#008a3e] cursor-pointer"
          >
            + Tạo CV
          </button>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="flex justify-center py-10">
              <Spin />
            </div>
          ) : builderCvs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300 mb-4">
                <InboxOutlined className="text-3xl" />
              </div>
              <p className="text-sm font-semibold text-slate-400">
                Chưa có CV nào được tạo.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {builderCvs.map((cv) => (
                <UserCvCard key={cv.public_id} cv={cv} onRefresh={fetchCvs} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CV đã tải lên máy tính */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800 sm:text-[17px]">
            CV đã tải lên {siteName}
          </h3>
          <button
            type="button"
            onClick={handleUploadClick}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#00b14f] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#008a3e] cursor-pointer"
          >
            <UploadOutlined />
            Tải CV lên
          </button>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="flex justify-center py-10"><Spin /></div>
          ) : uploadedCvs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300 mb-4">
                <CloudUploadOutlined className="text-3xl" />
              </div>
              <p className="text-sm font-semibold text-slate-400">
                Chưa có CV nào được tải lên.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {uploadedCvs.map((cv) => (
                <UserCvCard key={cv.public_id} cv={cv} onRefresh={fetchCvs} />
              ))}
            </div>
          )}
        </div>
      </section>

      {archivedCvs.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 sm:text-[17px]">CV đã lưu trữ</h3>
            <span className="text-xs font-medium text-slate-500">Có thời hạn khôi phục</span>
          </div>
          <div className="mt-5 space-y-3">
            {archivedCvs.map((cv) => (
              <ArchivedCvCard key={cv.public_id} cv={cv} onRefresh={fetchCvs} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
