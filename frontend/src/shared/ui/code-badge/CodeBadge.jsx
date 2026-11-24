import { CheckOutlined, CopyOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import './code-badge.css'

/**
 * Mã hiển thị (mã tin, mã công ty, mã NTD) dạng nhãn monospace kèm nút sao chép.
 * Nút sao chép chặn lan sự kiện để bấm trong một dòng danh sách không mở dòng đó.
 */
export default function CodeBadge({ code, label, size = 'sm', className = '' }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return undefined
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  if (!code) return null

  async function copy(event) {
    event.preventDefault()
    event.stopPropagation()
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      message.success(m.ui_code_copied({ code }))
    } catch {
      message.info(m.ui_code_copy_manually())
    }
  }

  const copyLabel = m.ui_code_copy({ code })
  return (
    <span className={`code-badge code-badge--${size} ${className}`.trim()}>
      {label && <span className="code-badge__label">{label}</span>}
      <span className="code-badge__value" translate="no">{code}</span>
      <button type="button" className="code-badge__copy" onClick={copy} aria-label={copyLabel} title={copyLabel}>
        {copied ? <CheckOutlined aria-hidden /> : <CopyOutlined aria-hidden />}
      </button>
    </span>
  )
}
