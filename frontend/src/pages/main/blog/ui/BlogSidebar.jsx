import { useEffect, useState } from 'react'
import { ArrowRightOutlined, SearchOutlined } from '@ant-design/icons'
import { AutoComplete, Button, Select } from 'antd'
import { Link } from 'react-router-dom'
import { getBanners, settingText, useSiteSettings } from '@/entities/site-settings'
import { getJobSuggestions } from '@/entities/job'
import { getProvinces } from '@/entities/location'
import { blogPostPath, getBlogPinnedPosts } from '@/entities/blog'
import useDebouncedValue from '@/shared/hooks/use-debounced-value'

const ALL_PROVINCES = ''

// Cột phải trang chi tiết: tìm việc nhanh, tài liệu hỗ trợ, banner quảng cáo.
export default function BlogSidebar() {
  const { settings } = useSiteSettings()
  const [pinned, setPinned] = useState([])
  const [banner, setBanner] = useState(null)

  useEffect(() => {
    let cancelled = false
    getBlogPinnedPosts().then((data) => { if (!cancelled) setPinned(data || []) }).catch(() => {})
    getBanners('blog_sidebar').then((data) => { if (!cancelled) setBanner((data || [])[0] || null) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const docsTitle = settingText(settings.blog_support_docs_title, 'Tài liệu hỗ trợ tìm việc')

  return (
    <aside className="flex flex-col gap-4 sm:gap-5">
      <JobSearchCard />

      {pinned.length > 0 && (
        <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] sm:rounded-2xl sm:p-5">
          <h2 className="mb-3 text-base font-bold text-[var(--brand-primary)]">{docsTitle}</h2>
          <ul className="space-y-1">
            {pinned.map((item) => (
              <li key={item.slug}>
                <Link
                  to={blogPostPath(item.slug)}
                  target="_blank"
                  rel="noopener"
                  className="group flex gap-2 rounded-lg px-2 py-1.5 text-sm leading-5 text-slate-600 transition-colors duration-200 hover:bg-[var(--brand-primary-soft)] hover:text-[var(--brand-primary)]"
                >
                  <span className="text-[var(--brand-primary)] transition-transform duration-200 group-hover:translate-x-0.5">›</span>
                  <span className="line-clamp-2">{item.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {banner && <BlogSidebarBanner banner={banner} />}
    </aside>
  )
}

function JobSearchCard() {
  const [provinces, setProvinces] = useState([])
  const [keyword, setKeyword] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [provinceId, setProvinceId] = useState(ALL_PROVINCES)
  const debouncedKeyword = useDebouncedValue(keyword, 320)
  const query = keyword.trim()
  const autocompleteOptions = suggestions.map((suggestion) => ({ value: suggestion, label: suggestion }))
  if (loadingSuggestions && query.length >= 2 && autocompleteOptions.length === 0) {
    autocompleteOptions.push({ value: '__loading__', label: 'Đang tải gợi ý...', disabled: true })
  }

  useEffect(() => {
    let cancelled = false
    getProvinces().then((data) => { if (!cancelled) setProvinces(data || []) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Chỉ lấy cụm từ gợi ý sau khi người dùng dừng gõ. Chọn gợi ý chỉ điền
  // input; người dùng vẫn chọn địa điểm rồi mới thực hiện tìm kiếm.
  useEffect(() => {
    const searchTerm = debouncedKeyword.trim()
    if (searchTerm.length < 2) {
      setSuggestions([])
      setLoadingSuggestions(false)
      return undefined
    }
    let cancelled = false
    setSuggestions([])
    setLoadingSuggestions(true)
    getJobSuggestions(searchTerm)
      .then((items) => { if (!cancelled) setSuggestions(items.slice(0, 8)) })
      .catch(() => { if (!cancelled) setSuggestions([]) })
      .finally(() => { if (!cancelled) setLoadingSuggestions(false) })
    return () => { cancelled = true }
  }, [debouncedKeyword])

  function submit(value) {
    const params = new URLSearchParams()
    const text = (typeof value === 'string' ? value : keyword).trim()
    if (text) params.set('search', text)
    if (provinceId) params.set('locations', String(provinceId))
    window.open(`/viec-lam${params.toString() ? `?${params}` : ''}`, '_blank', 'noopener')
  }

  function selectSuggestion(value) {
    setKeyword(value)
    setSearchFocused(false)
  }

  return (
    <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] sm:rounded-2xl sm:p-5">
      <h2 className="mb-3 text-base font-bold text-[var(--brand-primary)]">Tìm việc làm ngay</h2>
      <div className="flex flex-col gap-2.5">
        <AutoComplete
          value={keyword}
          options={autocompleteOptions}
          open={searchFocused && query.length >= 2}
          onChange={setKeyword}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          onSelect={selectSuggestion}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Vị trí, công ty, từ khóa..."
          className="w-full"
        />
        <div className="flex items-center gap-2">
          <Select
            showSearch
            optionFilterProp="label"
            value={provinceId}
            onChange={setProvinceId}
            options={[
              { value: ALL_PROVINCES, label: 'Tất cả tỉnh/thành phố' },
              ...provinces.map((p) => ({ value: p.id, label: p.name })),
            ]}
            className="min-w-0 flex-1"
          />
          <Button type="primary" aria-label="Tìm việc ngay" title="Tìm việc ngay" icon={<SearchOutlined />} onClick={() => submit()} className="!h-8 !w-9 !px-0" />
        </div>
      </div>
    </section>
  )
}

const GRADIENTS = {
  green: 'from-emerald-600 via-emerald-500 to-teal-400',
  blue: 'from-sky-600 via-blue-500 to-indigo-400',
  orange: 'from-orange-500 via-rose-400 to-pink-400',
}

function BlogSidebarBanner({ banner }) {
  const background = banner.image_url
    ? { backgroundImage: `url(${banner.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : undefined

  return (
    <section
      className={`relative overflow-hidden rounded-xl p-5 text-white shadow-sm sm:rounded-2xl sm:p-6 ${banner.image_url ? '' : `bg-gradient-to-br ${GRADIENTS[banner.theme] || GRADIENTS.green}`}`}
      style={background}
    >
      {banner.image_url && <div className="absolute inset-0 bg-black/35" />}
      <div className="relative">
        {banner.eyebrow && (
          <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-90">{banner.eyebrow}</p>
        )}
        <h3 className="mt-1.5 text-lg font-extrabold leading-6">{banner.title}</h3>
        {banner.subtitle && <p className="mt-1.5 text-sm leading-5 opacity-90">{banner.subtitle}</p>}
        <div className="mt-5 flex flex-col gap-2.5">
          {banner.cta_label && <BannerCta label={banner.cta_label} url={banner.cta_url} primary />}
          {banner.cta_secondary_label && (
            <BannerCta label={banner.cta_secondary_label} url={banner.cta_secondary_url} />
          )}
        </div>
      </div>
    </section>
  )
}

function BannerCta({ label, url, primary }) {
  const className = 'inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105'
  const style = primary
    ? {
        backgroundColor: '#ffffff',
        border: '1px solid rgba(255,255,255,0.95)',
        boxShadow: '0 7px 18px rgba(15,23,42,0.22)',
        color: '#0f172a',
      }
    : {
        backgroundColor: 'rgba(0,0,0,0.22)',
        border: '2px solid rgba(255,255,255,0.9)',
        boxShadow: '0 5px 14px rgba(15,23,42,0.16)',
        color: '#ffffff',
      }
  const content = (
    <>
      {label}
      <ArrowRightOutlined className={`text-xs ${primary ? 'text-[var(--brand-primary)]' : ''}`} />
    </>
  )
  if (!url) return <span className={className} style={style}>{content}</span>
  const external = /^https?:\/\//i.test(url)
  if (external) {
    return <a href={url} className={className} style={style} target="_blank" rel="noopener noreferrer">{content}</a>
  }
  return <Link to={url} target="_blank" rel="noopener" className={className} style={style}>{content}</Link>
}
