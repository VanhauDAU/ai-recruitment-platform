import { DeleteOutlined, MoreOutlined, StopOutlined, UnlockOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { connectPath, useConversationOptions } from '@/entities/messaging/conversation'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message as toast } from '@/shared/lib/toast'
import { Button, Dialog, IconButton, MenuList, Popover } from '@/shared/ui/connect-kit'

/** Nút 3 chấm của một dòng hội thoại: xóa phía mình, chặn / bỏ chặn nhắn tin. */
export default function ConversationMenu({ portal, conversation, active }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const { clear, block } = useConversationOptions(portal, conversation.public_id)
  const name = conversation.counterpart?.name || ''
  const blocked = Boolean(conversation.blocked_by_me)
  const fail = (error) => toast.error(getApiErrorMessage(error, m.connect_action_failed()))

  const items = [
    blocked
      ? { key: 'unblock', icon: <UnlockOutlined />, label: m.connect_menu_unblock() }
      : { key: 'block', icon: <StopOutlined />, label: m.connect_menu_block() },
    { key: 'delete', icon: <DeleteOutlined />, label: m.connect_menu_delete() },
  ]
  const select = (item) => {
    setOpen(false)
    if (item.key === 'unblock') {
      block.mutate(false, { onSuccess: () => toast.success(m.connect_unblocked_done()), onError: fail })
    } else {
      setConfirm(item.key)
    }
  }
  const run = () => {
    if (confirm === 'delete') {
      clear.mutate(undefined, {
        onSuccess: () => {
          setConfirm(null)
          toast.success(m.connect_deleted())
          if (active) navigate(connectPath(portal))
        },
        onError: fail,
      })
    } else {
      block.mutate(true, {
        onSuccess: () => {
          setConfirm(null)
          toast.success(m.connect_blocked_done())
        },
        onError: fail,
      })
    }
  }

  return (
    <div className={`pc-conv-item__menu${open || confirm ? ' pc-conv-item__menu--open' : ''}`}>
      <Popover
        open={open}
        onOpenChange={setOpen}
        align="end"
        side="bottom"
        label={m.connect_menu_label()}
        trigger={({ toggle }) => (
          <IconButton label={m.connect_menu_label()} aria-expanded={open} onClick={toggle}>
            <MoreOutlined />
          </IconButton>
        )}
      >
        <MenuList items={items} onSelect={select} />
      </Popover>
      <Dialog
        open={Boolean(confirm)}
        title={confirm === 'delete' ? m.connect_delete_title() : m.connect_block_title({ name })}
        onClose={() => setConfirm(null)}
        footer={(
          <>
            <Button variant="ink" onClick={() => setConfirm(null)}>{m.connect_cancel()}</Button>
            <Button variant="primary" loading={clear.isPending || block.isPending} onClick={run}>
              {confirm === 'delete' ? m.connect_menu_delete() : m.connect_menu_block()}
            </Button>
          </>
        )}
      >
        <p className="pc-dialog__hint">
          {confirm === 'delete' ? m.connect_delete_text({ name }) : m.connect_block_text()}
        </p>
      </Dialog>
    </div>
  )
}
