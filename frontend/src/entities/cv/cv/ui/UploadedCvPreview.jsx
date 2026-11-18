import { useQuery } from '@tanstack/react-query'
import { Skeleton } from 'antd'
import { useEffect, useState } from 'react'
import { getSharedCvFile, getUploadedCvFile } from '../api/cv.api'

// Chỉ hiển thị trang CV: ẩn thanh công cụ, bảng điều hướng và thanh cuộn của trình xem PDF.
const VIEWER_PARAMS = '#toolbar=0&navpanes=0&scrollbar=0&view=FitH'

/**
 * Tệp gốc (PDF; DOCX đã được máy chủ đổi sang PDF) của một CV tải lên.
 * Chủ CV đọc theo `publicId`; người xem link chia sẻ đọc theo `shareToken`.
 * Nguồn khác (vd. nhà tuyển dụng đọc tệp của một hồ sơ) truyền `source = { queryKey, load }`.
 */
export default function UploadedCvPreview({ publicId, shareToken, source, title, className = '' }) {
  const ownSource = shareToken
    ? { queryKey: ['cv', 'shared-source-file', shareToken], load: () => getSharedCvFile(shareToken) }
    : { queryKey: ['cv', 'source-file', publicId], load: () => getUploadedCvFile(publicId) }
  const { queryKey, load } = source || ownSource
  const { data: blob, isLoading, isError } = useQuery({ queryKey, queryFn: load, staleTime: Infinity })
  const [url, setUrl] = useState(null)

  useEffect(() => {
    if (!blob) return undefined
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])

  if (isError) {
    return (
      <div className={`flex items-center justify-center p-4 text-center text-xs font-semibold text-slate-400 ${className}`}>
        Không thể hiển thị tệp CV
      </div>
    )
  }
  if (isLoading || !url) {
    return (
      <div className={`p-4 ${className}`}>
        <Skeleton active paragraph={{ rows: 12 }} />
      </div>
    )
  }
  return (
    <iframe
      title={title || 'CV tải lên'}
      src={`${url}${VIEWER_PARAMS}`}
      className={`block border-0 bg-white ${className}`}
    />
  )
}
