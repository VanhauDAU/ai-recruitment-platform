import { companyInitial } from './company-presentation'

export default function CompanyLogo({
  className = '',
  company,
  eager = false,
  height = 72,
  imageClassName = '',
  width = 72,
}) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-slate-200 bg-white font-black text-emerald-700 shadow-sm ${className}`}
      aria-hidden="true"
    >
      <span>{companyInitial(company)}</span>
      {company?.logo_url && (
        <img
          src={company.logo_url}
          alt=""
          width={width}
          height={height}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : 'auto'}
          decoding="async"
          className={`absolute inset-0 h-full w-full bg-white object-contain ${imageClassName}`}
          onError={(event) => { event.currentTarget.style.display = 'none' }}
        />
      )}
    </span>
  )
}
