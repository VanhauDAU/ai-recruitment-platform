import { Children, cloneElement, isValidElement, useState } from 'react'
import ConfirmActionModal from './ConfirmActionModal'

function isPromise(value) {
  return value && typeof value.then === 'function'
}

export default function ConfirmAction({
  children,
  disabled = false,
  onCancel,
  onConfirm,
  onConfirmError,
  onDismiss,
  ...modalProps
}) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const trigger = Children.only(children)

  if (!isValidElement(trigger)) return trigger

  const close = (callback) => {
    if (confirming) return
    callback?.()
    setOpen(false)
  }
  const confirm = () => {
    let result
    try {
      result = onConfirm?.()
    } catch (error) {
      onConfirmError?.(error)
      return undefined
    }
    if (!isPromise(result)) {
      setOpen(false)
      return result
    }
    setConfirming(true)
    return result
      .then(() => setOpen(false))
      .catch((error) => onConfirmError?.(error))
      .finally(() => setConfirming(false))
  }
  const openConfirmation = (event) => {
    trigger.props.onClick?.(event)
    if (!event.defaultPrevented && !disabled && !trigger.props.disabled) setOpen(true)
  }

  return (
    <>
      {cloneElement(trigger, { onClick: openConfirmation })}
      <ConfirmActionModal
        {...modalProps}
        confirmLoading={confirming || modalProps.confirmLoading}
        onCancel={() => close(onCancel)}
        onConfirm={confirm}
        onDismiss={() => close(onDismiss || onCancel)}
        open={open}
      />
    </>
  )
}
