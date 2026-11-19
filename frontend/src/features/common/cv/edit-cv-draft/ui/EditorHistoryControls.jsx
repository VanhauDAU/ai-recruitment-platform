import { RedoOutlined, UndoOutlined } from '@ant-design/icons'
import { Button } from 'antd'

export default function EditorHistoryControls({ canUndo, canRedo, disabled, onUndo, onRedo }) {
  return (
    <div className="flex items-center gap-1" aria-label="Lịch sử chỉnh sửa">
      <Button size="small" aria-label="Hoàn tác" icon={<UndoOutlined />} disabled={disabled || !canUndo} onClick={onUndo}>Hoàn tác</Button>
      <Button size="small" aria-label="Làm lại" icon={<RedoOutlined />} disabled={disabled || !canRedo} onClick={onRedo}>Làm lại</Button>
    </div>
  )
}
