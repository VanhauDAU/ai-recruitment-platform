import { LeftOutlined, RightOutlined } from '@ant-design/icons'

// Circular prev/next arrow (green outline, hover-fill). Shared by carousels & paginators.
const CLASS =
  'w-8 h-8 shrink-0 flex items-center justify-center rounded-full border transition-all duration-150 ' +
  'disabled:border-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed ' +
  'enabled:border-[var(--brand-primary)] enabled:text-[var(--brand-primary)] enabled:cursor-pointer ' +
  'enabled:hover:bg-[var(--brand-primary)] enabled:hover:text-white enabled:hover:shadow-md enabled:hover:shadow-green-200 enabled:active:scale-90'

export default function ArrowButton({ dir = 'left', className = '', ...props }) {
  return (
    <button type="button" className={`${CLASS} ${className}`} {...props}>
      {dir === 'left' ? <LeftOutlined className="text-xs" /> : <RightOutlined className="text-xs" />}
    </button>
  )
}
