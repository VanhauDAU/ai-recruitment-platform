import { useCallback, useEffect, useRef, useState } from 'react'
import { getApiErrorMessage } from '@/shared/api/error-mapper'

const DEFAULT_OMIT = ['impact_token', 'reason', 'tax_override_reason', 'enforcement_evidence']

function stripKeys(value, omit) {
  if (Array.isArray(value)) return value.map((item) => stripKeys(item, omit))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !omit.includes(key))
      .map(([key, item]) => [key, stripKeys(item, omit)]),
  )
}

/** What the admin saw, minus the audit text they typed and the signed token. */
export function impactFingerprint(impact, omit = DEFAULT_OMIT) {
  return impact ? JSON.stringify(stripKeys(impact, omit)) : ''
}

/**
 * Preview-on-open + one-click confirm for impact-token actions.
 *
 * The backend accepts a preview with blank audit fields, so the impact loads
 * as soon as the dialog opens (`preview(null)`). On submit the preview runs
 * again with the final values (the reason is signed into the token) and, if
 * nothing the admin saw has changed, confirms in the same click. A changed
 * impact or a 409 shows the fresh impact and waits for a second click.
 *
 * `previewKey` re-runs the open-time preview when a non-audit input changes
 * (target status, decision, tax override…).
 */
export default function useImpactConfirmation({
  confirm,
  fingerprintOmit = DEFAULT_OMIT,
  open,
  preview,
  previewKey = '',
  ready = true,
}) {
  const [impact, setImpact] = useState(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [changed, setChanged] = useState(false)
  const handlers = useRef({ confirm, preview })
  handlers.current = { confirm, preview }
  const omitKey = fingerprintOmit.join('|')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setImpact(await handlers.current.preview(null))
    } catch (previewError) {
      setImpact(null)
      setError(getApiErrorMessage(previewError, 'Không thể tải tác động.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setChanged(false)
    if (!open || !ready) {
      setImpact(null)
      setError('')
      return
    }
    load()
  }, [open, ready, previewKey, load])

  const submit = useCallback(async (values) => {
    const omit = omitKey.split('|')
    setSubmitting(true)
    try {
      const fresh = await handlers.current.preview(values)
      const unseen = !impact || impactFingerprint(fresh, omit) !== impactFingerprint(impact, omit)
      setImpact(fresh)
      setError('')
      if (unseen || fresh.can_apply === false) {
        setChanged(Boolean(impact) && unseen)
        return false
      }
      await handlers.current.confirm(fresh, values)
      return true
    } catch (submitError) {
      if (submitError?.response?.status !== 409) throw submitError
      setImpact(await handlers.current.preview(values))
      setChanged(true)
      return false
    } finally {
      setSubmitting(false)
    }
  }, [impact, omitKey])

  return { changed, error, impact, loading, reload: load, submit, submitting }
}
