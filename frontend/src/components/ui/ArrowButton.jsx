import { LeftOutlined, RightOutlined } from '@ant-design/icons'

// Circular prev/next arrow (green outline, hover-fill). Shared by carousels & paginators.
const CLASS =
  'w-8 h-8 shrink-0 flex items-center justify-center rounded-full border transition-all duration-150 ' +
  'disabled:border-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed ' +
  'enabled:border-[#00b14f] enabled:text-[#00b14f] enabled:cursor-pointer ' +
  'enabled:hover:bg-[#00b14f] enabled:hover:text-white enabled:hover:shadow-md enabled:hover:shadow-green-200 enabled:active:scale-90'

export default function ArrowButton({ dir = 'left', className = '', ...props }) {
  return (
    <button type="button" className={`${CLASS} ${className}`} {...props}>
      {dir === 'left' ? <LeftOutlined className="text-xs" /> : <RightOutlined className="text-xs" />}
    </button>
  )
}
