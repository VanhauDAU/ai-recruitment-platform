import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import useImpactConfirmation, { impactFingerprint } from './use-impact-confirmation'

const impact = (count, token = `token-${count}`) => ({ count, reason: 'x', impact_token: token, can_apply: true })

function setup({ preview, confirm = vi.fn().mockResolvedValue({}), ready = true }) {
  return renderHook((props) => useImpactConfirmation({ open: true, preview, confirm, ...props }), {
    initialProps: { ready },
  })
}

describe('useImpactConfirmation', () => {
  it('ignores the typed reason and the token when comparing impacts', () => {
    expect(impactFingerprint(impact(1, 'a'))).toBe(impactFingerprint({ ...impact(1, 'b'), reason: 'y' }))
    expect(impactFingerprint(impact(1))).not.toBe(impactFingerprint(impact(2)))
  })

  it('previews on open, then re-previews with the final values and confirms in one call', async () => {
    const preview = vi.fn().mockResolvedValue(impact(1))
    const confirm = vi.fn().mockResolvedValue({})
    const { result } = setup({ preview, confirm })
    await waitFor(() => expect(result.current.impact).toEqual(impact(1)))
    expect(preview).toHaveBeenCalledWith(null)

    let done
    await act(async () => { done = await result.current.submit({ reason: 'Lý do' }) })
    expect(done).toBe(true)
    expect(preview).toHaveBeenLastCalledWith({ reason: 'Lý do' })
    expect(confirm).toHaveBeenCalledWith(impact(1), { reason: 'Lý do' })
  })

  it('waits until ready, and stops for a second look when the impact changed', async () => {
    const preview = vi.fn().mockResolvedValueOnce(impact(1)).mockResolvedValue(impact(2))
    const confirm = vi.fn().mockResolvedValue({})
    const { result, rerender } = setup({ preview, confirm, ready: false })
    expect(preview).not.toHaveBeenCalled()

    rerender({ ready: true })
    await waitFor(() => expect(result.current.impact).toEqual(impact(1)))
    let done
    await act(async () => { done = await result.current.submit({}) })
    expect(done).toBe(false)
    expect(result.current.changed).toBe(true)
    expect(confirm).not.toHaveBeenCalled()

    await act(async () => { done = await result.current.submit({}) })
    expect(done).toBe(true)
    expect(confirm).toHaveBeenCalledWith(impact(2), {})
  })

  it('reloads the impact after a 409 instead of retrying the confirm', async () => {
    const preview = vi.fn().mockResolvedValue(impact(1))
    const confirm = vi.fn().mockRejectedValue({ response: { status: 409 } })
    const { result } = setup({ preview, confirm })
    await waitFor(() => expect(result.current.impact).not.toBeNull())

    let done
    await act(async () => { done = await result.current.submit({}) })
    expect(done).toBe(false)
    expect(result.current.changed).toBe(true)
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(preview).toHaveBeenCalledTimes(3)
  })

  it('shows a preview error and lets the admin retry', async () => {
    const preview = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(impact(1))
    const { result } = setup({ preview })
    await waitFor(() => expect(result.current.error).toBeTruthy())
    await act(async () => { await result.current.reload() })
    expect(result.current.impact).toEqual(impact(1))
    expect(result.current.error).toBe('')
  })
})
