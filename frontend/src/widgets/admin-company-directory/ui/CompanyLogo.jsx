import { Avatar, Tooltip } from 'antd'

const LEGAL_WORDS = new Set([
  'co', 'company', 'cong', 'corporation', 'cp', 'cty', 'doanh', 'hạn', 'han',
  'hữu', 'huu', 'nghiệp', 'nghiep', 'nhiệm', 'nhiem', 'phần', 'phan', 'tập',
  'tap', 'tnhh', 'trách', 'trach', 'ty', 'đoàn', 'doan',
])

function companyInitials(name = '') {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const meaningfulWords = words.filter(
    (word) => !LEGAL_WORDS.has(word.toLocaleLowerCase('vi-VN')),
  )
  const source = meaningfulWords.length ? meaningfulWords : words

  if (!source.length) return 'CT'
  if (source.length === 1) return source[0].slice(0, 2).toLocaleUpperCase('vi-VN')
  return `${source[0][0]}${source.at(-1)[0]}`.toLocaleUpperCase('vi-VN')
}

export default function CompanyLogo({
  company,
  size = 42,
  className = '',
}) {
  const hasLogo = Boolean(company.logo_url)
  const label = hasLogo
    ? `Logo ${company.company_name}`
    : `${company.company_name} chưa cập nhật logo`
  const avatar = (
    <Avatar
      aria-label={label}
      className={[
        'company-logo',
        hasLogo ? 'company-logo--image' : 'company-logo--fallback',
        className,
      ].filter(Boolean).join(' ')}
      shape="square"
      size={size}
      src={hasLogo ? company.logo_url : undefined}
    >
      {!hasLogo && companyInitials(company.company_name)}
    </Avatar>
  )

  return hasLogo ? avatar : <Tooltip title="Công ty chưa cập nhật logo">{avatar}</Tooltip>
}
