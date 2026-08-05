import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AnnouncementDetailDrawer from './AnnouncementDetailDrawer'

vi.mock('./AnnouncementMetrics', () => ({ default: () => <div /> }))
vi.mock('./AnnouncementPreview', () => ({ default: () => <div /> }))

function detailFor(lifecycleState) {
  return {
    public_id: 'ann_1',
    internal_name: 'Thông báo bảo trì',
    lifecycle_state: lifecycleState,
    presentation_status: lifecycleState,
    revision_token: 7,
    dismissal_version: 3,
    draft_revision_number: null,
    revisions: [{
      number: 2,
      kind: 'maintenance',
      priority: 500,
      surfaces: ['candidate'],
      include_path_prefixes: [],
      exclude_path_prefixes: [],
      message_vi: 'Hệ thống bảo trì.',
      is_active: true,
      starts_at: null,
      ends_at: null,
    }],
    audit_events: [],
  }
}

function renderDrawer(lifecycleState, overrides = {}) {
  const onAction = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AnnouncementDetailDrawer
        open
        detail={detailFor(lifecycleState)}
        canPublish
        canManage
        onAction={onAction}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        onEdit={vi.fn()}
        onReload={vi.fn()}
        onRename={vi.fn()}
        {...overrides}
      />
    </QueryClientProvider>,
  )
  return { onAction }
}

describe('AnnouncementDetailDrawer re-show action', () => {
  it('lets an operator re-show a published announcement to readers who closed it', () => {
    const { onAction } = renderDrawer('published')

    fireEvent.click(screen.getByRole('button', { name: /Hiện lại cho người đã đóng/ }))

    expect(onAction).toHaveBeenCalledWith('reset-dismissals')
  })

  it('surfaces the dismissal version so a hidden announcement is diagnosable', () => {
    renderDrawer('published')

    expect(screen.getByText('Phiên bản hiển thị lại')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('hides the action while the announcement is not live', () => {
    renderDrawer('paused')

    expect(screen.queryByRole('button', { name: /Hiện lại cho người đã đóng/ })).not.toBeInTheDocument()
  })

  it('hides the action without publish permission', () => {
    renderDrawer('published', { canPublish: false })

    expect(screen.queryByRole('button', { name: /Hiện lại cho người đã đóng/ })).not.toBeInTheDocument()
  })
})
