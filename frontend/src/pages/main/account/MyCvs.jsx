import {
  ArrowUpOutlined,
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
  UploadOutlined,
} from '@ant-design/icons'
import { Dropdown, Input, Modal, Spin, Switch, message } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  createCvSharedLink,
  CvDocumentPreview,
  deleteCv,
  getCvOwnerView,
  getMyCvs,
  importCvFile,
  renameCv,
  setDefaultCv,
} from '@/entities/cv'
import { useSiteSettings } from '@/entities/site-settings'

function UserCvCard({ cv, onRefresh }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchable, setSearchable] = useState(true)
  const [isMainCv, setIsMainCv] = useState(cv.is_default || false)
  const [isRenameOpen, setIsRenameOpen] = useState(false)
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

  const handleToggleSearch = (checked) => {
    setSearchable(checked)
    if (checked) {
      message.success('Đã cho phép Nhà tuyển dụng tìm kiếm CV này.')
    } else {
      message.warning('Đã tắt chế độ Nhà tuyển dụng tìm kiếm CV này.')
    }
  }

  // Cập nhật trạng thái CV chính trực tiếp xuống DB qua patch
  const handleToggleMain = async () => {
    const nextState = !isMainCv
    try {
      await setDefaultCv(cv.public_id, nextState)
      setIsMainCv(nextState)
      if (nextState) {
        message.success('Đã đặt CV này làm CV chính.')
      } else {
        message.success('Đã bỏ đặt CV này làm CV chính.')
      }
      onRefresh?.()
    } catch {
      message.error('Không thể cập nhật trạng thái CV chính.')
    }
  }

  // Tải xuống PDF (mở bản xem để in hoặc xuất file)
  const handleDownload = () => {
    message.loading('Đang chuẩn bị bản tải xuống...', 1).then(() => {
      window.open(`/cvs/${cv.public_id}/view`, '_blank')
    })
  }

  // Đẩy top (Tính năng VIP của TopCV)
  const handlePushTop = () => {
    message.loading('Đang xử lý đẩy top...', 1).then(() => {
      message.success('Đẩy top thành công! CV của bạn đã được ưu tiên hiển thị trước Nhà tuyển dụng.')
    })
  }

  // Sao chép liên kết CV
  const handleCopyLink = async () => {
    try {
      // A bearer token is returned only at creation time; never try to read it
      // back from the link list or persist it in the browser.
      const { token } = await createCvSharedLink(cv.public_id)
      const shareUrl = `${window.location.origin}/cv/share/${token}`
      await navigator.clipboard.writeText(shareUrl)
      message.success('Đã sao chép liên kết chia sẻ CV.')
    } catch {
      message.error('Không thể tạo liên kết chia sẻ.')
    }
  }

  // Chia sẻ lên Facebook
  const handleShareFacebook = async () => {
    try {
      const { token } = await createCvSharedLink(cv.public_id)
      const shareUrl = `${window.location.origin}/cv/share/${token}`
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank')
    } catch {
      message.error('Không thể thực hiện liên kết chia sẻ.')
    }
  }

  // Tạo bản sao CV
  const handleDuplicate = () => {
    message.loading('Đang nhân bản CV...', 1.2).then(() => {
      message.success('Tạo bản sao CV thành công.')
      onRefresh?.()
    })
  }

  // Đổi tên CV
  const handleRenameClick = () => {
    setNewTitle(cv.title)
    setIsRenameOpen(true)
  }

  const handleRenameSubmit = async () => {
    if (!newTitle.trim()) {
      message.warning('Vui lòng nhập tên CV.')
      return
    }
    try {
      await renameCv(cv.public_id, newTitle.trim())
      message.success('Đổi tên CV thành công.')
      setIsRenameOpen(false)
      onRefresh?.()
    } catch {
      message.error('Không thể đổi tên CV.')
    }
  }

  // Xoá CV
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
          message.success('Đã xóa CV thành công.')
          onRefresh?.()
        } catch {
          message.error('Không thể xóa CV.')
        }
      },
    })
  }

  const dropdownMenuItems = [
    {
      key: 'push-top',
      label: 'Đẩy top',
      icon: <ArrowUpOutlined />,
      onClick: handlePushTop,
    },
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
    {
      key: 'duplicate',
      label: 'Tạo bản sao',
      icon: <CopyOutlined />,
      onClick: handleDuplicate,
    },
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
      {/* Viewport xem trước CV bo tròn */}
      <div
        ref={previewWrapRef}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false)
          setIsMenuOpen(false)
        }}
        className="group relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50 p-4 flex justify-center cursor-default"
      >
        {/* Ngôi sao CV chính ở góc trên bên phải - Ẩn mặc định, hiện khi hover hoặc khi là CV chính */}
        <button
          type="button"
          onClick={handleToggleMain}
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
            className={[
              'absolute inset-0 bg-gradient-to-t from-black/45 via-black/15 to-transparent flex items-end justify-center pb-5 transition-opacity duration-200',
              (hovered || isMenuOpen) ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
            ].join(' ')}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold text-slate-700 hover:text-[#00b14f] transition shadow-sm cursor-pointer border border-slate-100 hover:scale-105"
                style={{ backgroundColor: '#ffffff' }}
              >
                <DownloadOutlined /> Tải về
              </button>
              <Link
                to={`/cvs/${cv.public_id}/edit`}
                className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold text-slate-700 hover:text-[#00b14f] transition shadow-sm cursor-pointer border border-slate-100 hover:scale-105"
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
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 hover:text-[#00b14f] transition shadow-sm cursor-pointer border border-slate-100 hover:scale-105"
                  style={{ backgroundColor: '#ffffff' }}
                >
                  <EllipsisOutlined className="text-base" />
                </button>
              </Dropdown>
            </div>
          </div>
        )}
      </div>

      {/* Thông tin tiêu đề & Switch tìm kiếm */}
      <div className="space-y-1 px-0.5">
        <h4 className="truncate text-sm font-bold text-slate-800">
          {cv.title}
        </h4>
        <p className="text-xs text-slate-400">
          Cập nhật {formattedDate}
        </p>

        {/* Switch trạng thái tìm kiếm */}
        <div className="flex items-center gap-2 pt-1.5">
          <Switch
            size="small"
            checked={searchable}
            onChange={handleToggleSearch}
            style={{ backgroundColor: searchable ? '#00b14f' : undefined }}
          />
          <span className="text-[12px] font-semibold text-slate-600">
            Cho phép NTD tìm kiếm
          </span>
        </div>
      </div>

      {/* Modal Rename */}
      <Modal
        title="Đổi tên CV"
        open={isRenameOpen}
        onOk={handleRenameSubmit}
        onCancel={() => setIsRenameOpen(false)}
        okText="Lưu lại"
        cancelText="Hủy"
        destroyOnClose
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

export default function MyCvs() {
  const { siteName } = useSiteSettings()
  const navigate = useNavigate()
  const [cvs, setCvs] = useState([])
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef(null)

  const fetchCvs = () => {
    let cancelled = false
    setLoading(true)
    getMyCvs()
      .then((data) => {
        if (!cancelled) setCvs(data)
      })
      .catch(() => {
        if (!cancelled) setCvs([])
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
    </div>
  )
}
