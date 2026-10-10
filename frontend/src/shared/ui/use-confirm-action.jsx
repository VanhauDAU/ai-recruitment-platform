import { useCallback, useState } from 'react'
import ConfirmActionModal from './ConfirmActionModal'

function isPromise(value) {
  return value && typeof value.then === 'function'
}

export default function useConfirmAction() {
  const [request, setRequest] = useState(null)
  const [confirming, setConfirming] = useState(false)

  const requestConfirmation = useCallback((options) => setRequest(options), [])
  const cancelConfirmation = useCallback(() => {
    if (confirming) return
    request?.onCancel?.()
    setRequest(null)
  }, [confirming, request])
  const dismissConfirmation = useCallback(() => {
    if (confirming) return
    if (request?.onDismiss) request.onDismiss()
    else request?.onCancel?.()
    setRequest(null)
  }, [confirming, request])
  const confirmAction = useCallback(() => {
    let result
    try {
      result = request?.onConfirm?.()
    } catch (error) {
      request?.onConfirmError?.(error)
      return undefined
    }
    if (!isPromise(result)) {
      setRequest(null)
      return result
    }
    setConfirming(true)
    return result
      .then(() => setRequest(null))
      .catch((error) => request?.onConfirmError?.(error))
      .finally(() => setConfirming(false))
  }, [request])

  const confirmationModal = (
    <ConfirmActionModal
      {...request}
      confirmLoading={confirming || request?.confirmLoading}
      onCancel={cancelConfirmation}
      onConfirm={confirmAction}
      onDismiss={dismissConfirmation}
      open={Boolean(request)}
    />
  )

  return {
    cancelConfirmation,
    confirmationModal,
    dismissConfirmation,
    requestConfirmation,
  }
}
