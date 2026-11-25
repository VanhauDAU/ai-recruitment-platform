import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Form } from 'antd'
import { describe, expect, it, vi } from 'vitest'
import { getEditorCompletion } from '../model/editor-completion'
import BlogEditorSidebar from './BlogEditorSidebar'

vi.mock('./BlogTagPicker', () => ({ default: () => null }))

describe('BlogEditorSidebar thumbnail link', () => {
  it('imports the pasted link and clears the input', async () => {
    const onImport = vi.fn().mockResolvedValue({})
    render(
      <Form>
        <BlogEditorSidebar allowedActions={[]} completion={getEditorCompletion({})} jobs={[]} onImportThumbnail={onImport} tags={[]} values={{}} />
      </Form>,
    )
    const input = screen.getByLabelText('Đường dẫn ảnh đại diện')
    fireEvent.change(input, { target: { value: '  https://example.com/a.png ' } })
    fireEvent.click(screen.getByText('Dùng link'))

    expect(onImport).toHaveBeenCalledWith('https://example.com/a.png')
    await waitFor(() => expect(input.value).toBe(''))
  })
})
