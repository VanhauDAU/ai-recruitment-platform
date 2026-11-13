import { SearchOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { useSiteSettings } from '@/entities/site-settings'

function HeroInteractiveImage() {
  return (
    <div
      data-testid="company-directory-hero-visual"
      className="relative flex items-center justify-center p-2"
      style={{ transform: 'none' }}
    >
      <picture className="block">
        <source srcSet="/images/company/company-directory-hero.webp" type="image/webp" />
        <img
          src="/images/company/company-directory-hero.png"
          alt="ProCV - Kết nối tài năng - Kiến tạo tương lai"
          width="1024"
          height="479"
          loading="eager"
          fetchPriority="high"
          decoding="async"
          draggable={false}
          className="h-auto max-h-64 w-full max-w-md rounded-2xl object-contain drop-shadow-sm"
        />
      </picture>
    </div>
  )
}

function CompanySearchForm({ query, onQueryChange }) {
  const [draft, setDraft] = useState(query)

  useEffect(() => setDraft(query), [query])

  function submit(event) {
    event.preventDefault()
    onQueryChange(draft.trim())
  }

  return (
    <form onSubmit={submit} role="search" className="flex max-w-2xl flex-col gap-2 rounded-2xl border border-slate-200/90 bg-white p-2 shadow-[0_14px_34px_rgba(5,150,105,0.12)] sm:flex-row">
      <label className="flex min-w-0 flex-1 items-center gap-3 px-3">
        <SearchOutlined className="shrink-0 text-lg text-emerald-600" aria-hidden="true" />
        <span className="sr-only">Tên công ty</span>
        <input
          type="search"
          value={draft}
          maxLength={120}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Nhập tên công ty"
          className="h-11 min-w-0 flex-1 border-0 bg-transparent text-base text-slate-800 outline-none placeholder:text-slate-400"
        />
      </label>
      <button type="submit" className="h-11 shrink-0 rounded-xl bg-[var(--brand-primary)] px-7 text-sm font-bold text-white transition hover:bg-[var(--brand-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
        Tìm kiếm
      </button>
    </form>
  )
}

export function CompanyDirectoryHero({ query, onQueryChange }) {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: 'transparent linear-gradient(6deg, #fff, #c4ffdd 100%, rgba(195, 255, 221, .702) 0) 0 0 no-repeat padding-box',
      }}
    >
      <span className="pointer-events-none absolute -left-20 top-10 h-52 w-52 rounded-full bg-emerald-200/30 blur-3xl" aria-hidden="true" />
      <span className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-teal-200/35 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-14 md:grid-cols-[minmax(0,1.5fr)_minmax(250px,0.65fr)] md:items-center lg:px-8 lg:py-16">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-700">Danh sách công ty</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-black leading-tight text-slate-900 sm:text-4xl">
            Khám phá công ty phù hợp với bạn
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Tra cứu thông tin công ty và tìm kiếm nơi làm việc tốt nhất dành cho bạn.
          </p>
          <div className="mt-7">
            <CompanySearchForm query={query} onQueryChange={onQueryChange} />
          </div>
        </div>

        <div className="relative hidden md:flex md:items-center md:justify-center">
          <HeroInteractiveImage />
        </div>
      </div>
    </section>
  )
}

export function CompanySearchHeader({ query, onQueryChange }) {
  const { siteName } = useSiteSettings()

  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 sm:py-6 md:grid-cols-[minmax(0,1.5fr)_minmax(220px,0.65fr)] md:items-center lg:px-8">
        <div className="min-w-0">
          <h1 className="max-w-3xl text-lg font-bold leading-snug text-slate-900 sm:text-xl lg:text-2xl">
            Tìm kiếm thông tin công ty để {siteName} kết nối bạn với những{' '}
            <span className="text-[var(--brand-primary)]">cơ hội việc làm</span>{' '}
            phù hợp nhất
          </h1>
          <div className="mt-4">
            <CompanySearchForm query={query} onQueryChange={onQueryChange} />
          </div>
        </div>

        <div data-testid="company-search-hero-visual" className="hidden items-center justify-center md:flex">
          <picture className="block">
            <source srcSet="/images/company/company-search-illustration.webp" type="image/webp" />
            <img
              src="/images/company/company-search-illustration.png"
              alt="Minh họa kết nối ứng viên với cơ hội việc làm"
              width="705"
              height="660"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              draggable={false}
              className="h-auto max-h-44 w-full max-w-xs object-contain"
            />
          </picture>
        </div>
      </div>
    </section>
  )
}
