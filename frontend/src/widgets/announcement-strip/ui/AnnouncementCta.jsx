import { RightOutlined } from '@ant-design/icons'
import { Link } from 'react-router'

export default function AnnouncementCta({ cta }) {
  if (!cta) return null
  const className = 'announcement-strip__cta'
  const content = <>{cta.label}<RightOutlined aria-hidden /></>
  if (cta.external) {
    return (
      <a
        className={className}
        href={cta.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {content}
      </a>
    )
  }
  return <Link className={className} to={cta.url}>{content}</Link>
}
