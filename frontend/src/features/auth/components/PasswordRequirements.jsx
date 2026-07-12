import { CheckCircleFilled } from '@ant-design/icons'
import { getPasswordRequirements } from './passwordValidation'

export default function PasswordRequirements({ password }) {
  if (!password) return null

  const requirements = getPasswordRequirements(password)
  const items = [
    { key: 'length', label: 'Mật khẩu từ 6 đến 25 ký tự' },
    { key: 'composition', label: 'Bao gồm chữ hoa, chữ thường và ký tự số' },
  ]

  return (
    <ul
      aria-label="Điều kiện mật khẩu"
      className="mb-3 mt-[-0.35rem] space-y-1 rounded-xl bg-gray-50 px-3 py-2 text-xs dark:bg-zinc-900"
    >
      {items.map(({ key, label }) => (
        <li
          key={key}
          className={`flex items-center gap-2 transition-colors ${
            requirements[key] ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {requirements[key] ? (
            <CheckCircleFilled aria-hidden="true" />
          ) : (
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
          )}
          <span>{label}</span>
        </li>
      ))}
    </ul>
  )
}
