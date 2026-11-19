import { QuestionCircleOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'
import { m } from '@/shared/config/i18n'

const BUTTON_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  marginLeft: 4,
  padding: 0,
  border: 0,
  background: 'none',
  color: '#94a3b8',
  cursor: 'help',
  fontSize: '0.9em',
  verticalAlign: 'middle',
  lineHeight: 1,
}

// Icon "?" cạnh một chỉ số: rê chuột hoặc focus bằng bàn phím để đọc giải thích.
export default function HelpTip({ children, label = m.ui_help_tip_label() }) {
  return (
    <Tooltip title={children} styles={{ root: { maxWidth: 320 } }}>
      <button type="button" style={BUTTON_STYLE} aria-label={label} onClick={(event) => event.stopPropagation()}>
        <QuestionCircleOutlined aria-hidden />
      </button>
    </Tooltip>
  )
}
