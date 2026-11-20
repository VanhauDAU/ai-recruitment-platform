import { Link } from 'react-router'
import { isExternalUrl } from '@/entities/content/banner'

/** Link nội bộ dùng router; link ngoài mở tab mới. Không có href thì chỉ là khối tĩnh. */
export default function SlideLink({ href, className, children, ...rest }) {
  if (!href) return <div className={className} {...rest}>{children}</div>
  if (isExternalUrl(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} {...rest}>
        {children}
      </a>
    )
  }
  return <Link to={href} className={className} {...rest}>{children}</Link>
}
