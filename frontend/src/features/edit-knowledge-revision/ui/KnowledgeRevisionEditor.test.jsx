import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfigProvider } from 'antd'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { draftStorageKey } from '../model/editor-model'
import KnowledgeRevisionEditor from './KnowledgeRevisionEditor'

vi.mock('./KnowledgeEditorFields', async () => {
  const { Form, Input } = await import('antd')

  return {
    default: function KnowledgeEditorFieldsTestDouble({ dirty }) {
      return (
        <div>
          <span data-testid="editor-dirty-state">{dirty ? 'dirty' : 'clean'}</span>
          <Form.Item name="title">
            <Input aria-label="Tiêu đề biên tập" />
          </Form.Item>
        </div>
      )
    },
  }
})

vi.mock('./NewRevisionModal', () => ({ default: () => null }))

const ARTICLE = {
  public_id: 'kba_login',
  revision_token: 'revision-token-2',
  article_type: 'FAQ',
  category: { public_id: 'kbc_account', name: 'Tài khoản' },
  slug: 'dang-nhap',
  order: 0,
  revisions: [{
    number: 2,
    status: 'DRAFT',
    title: 'Tiêu đề trên máy chủ',
    body: '<p>Nội dung trên máy chủ</p>',
    source_reference: 'Tài liệu máy chủ',
    change_summary: '',
    seo_title: '',
    seo_description: '',
  }],
}

const CATEGORIES = [{
  public_id: 'kbc_account',
  name: 'Tài khoản',
  is_active: true,
}]

function renderEditorWithLocalDraft() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })
  const storageKey = draftStorageKey(ARTICLE.public_id)
  const localDraft = JSON.stringify({
    values: {
      title: 'Tiêu đề chưa lưu trên máy',
      body: '<p>Nội dung chưa lưu trên máy</p>',
      source_reference: 'Tài liệu cục bộ',
    },
    revision_token: ARTICLE.revision_token,
    saved_at: '2026-08-11T08:30:00.000Z',
  })
  window.localStorage.setItem(storageKey, localDraft)

  const rendered = render(
    <ConfigProvider theme={{ token: { motion: false } }} wave={{ disabled: true }}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <KnowledgeRevisionEditor
            article={ARTICLE}
            canManage
            categories={CATEGORIES}
          />
        </MemoryRouter>
      </QueryClientProvider>
    </ConfigProvider>,
  )

  return { ...rendered, localDraft, storageKey }
}

async function dismissRestoreDialog(method, user, dialog) {
  if (method === 'cancel') {
    await user.click(within(dialog).getByRole('button', { name: 'Đóng' }))
    return
  }
  if (method === 'close') {
    await user.click(within(dialog).getByRole('button', { name: 'Đóng hộp thoại' }))
    return
  }
  fireEvent.keyDown(dialog, { key: 'Escape' })
}

describe('KnowledgeRevisionEditor local draft recovery', () => {
  beforeEach(() => window.localStorage.clear())

  it.each([
    ['nút Đóng', 'cancel'],
    ['nút X', 'close'],
    ['phím Escape', 'escape'],
  ])('keeps the local draft when dismissing with %s', async (_label, method) => {
    const user = userEvent.setup()
    const { localDraft, storageKey } = renderEditorWithLocalDraft()
    const dialog = await screen.findByRole('dialog', { name: 'Khôi phục nội dung chưa lưu' })

    await dismissRestoreDialog(method, user, dialog)

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Khôi phục nội dung chưa lưu' }))
        .not.toBeInTheDocument()
    })
    expect(window.localStorage.getItem(storageKey)).toBe(localDraft)
  })

  it('applies the local values and marks the editor dirty after recovery', async () => {
    const user = userEvent.setup()
    const { localDraft, storageKey } = renderEditorWithLocalDraft()
    const dialog = await screen.findByRole('dialog', { name: 'Khôi phục nội dung chưa lưu' })

    expect(screen.getByLabelText('Tiêu đề biên tập')).toHaveValue('Tiêu đề trên máy chủ')
    await user.click(within(dialog).getByRole('button', { name: 'Khôi phục' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Tiêu đề biên tập'))
        .toHaveValue('Tiêu đề chưa lưu trên máy')
      expect(screen.getByTestId('editor-dirty-state')).toHaveTextContent('dirty')
    })
    expect(window.localStorage.getItem(storageKey)).toBe(localDraft)
  })
})
