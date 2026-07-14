import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { OwnerCvVersionView, SharedCvVersionView } from './CvVersionReadOnly'

const preview = vi.fn()

vi.mock('@/entities/cv', () => ({
  CvDocumentPreview: (props) => {
    preview(props)
    return <div data-testid="immutable-preview">{props.rendererKey}</div>
  },
}))

const immutableResponse = {
  cv: { public_id: 'cv_1', title: 'CV bất biến', language: 'vi-VN' },
  version: {
    public_id: 'cvv_2', version_number: 2, schema_version: 1,
    template_renderer_key: 'classic_two_column_v1',
    content_json: { personal_info: { full_name: 'Nguyễn An' }, sections: [] },
    layout_json: { regions: [] },
    style_json: { theme_color: '#00A66A' },
  },
}

describe('read-only CV version viewer', () => {
  it('renders the owner view through the shared renderer contract using an immutable version only', async () => {
    const loadOwnerView = vi.fn().mockResolvedValue(immutableResponse)
    render(
      <MemoryRouter>
        <OwnerCvVersionView publicId="cv_1" loadOwnerView={loadOwnerView} />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Xem CV Online của CV bất biến')).toBeInTheDocument()
    expect(screen.getByTestId('immutable-preview')).toHaveTextContent('classic_two_column_v1')
    expect(loadOwnerView).toHaveBeenCalledWith('cv_1')
    expect(preview).toHaveBeenLastCalledWith(expect.objectContaining({
      rendererKey: 'classic_two_column_v1',
      document: expect.objectContaining({ content_json: immutableResponse.version.content_json }),
    }))
  })

  it('does not reveal whether a public shared token was invalid, expired, or revoked', async () => {
    const loadSharedView = vi.fn().mockRejectedValue(new Error('Not found'))
    render(<SharedCvVersionView token="invalid" loadSharedView={loadSharedView} />)

    expect(await screen.findByText('Liên kết chia sẻ không tồn tại hoặc đã hết hạn.')).toBeInTheDocument()
    expect(loadSharedView).toHaveBeenCalledWith('invalid')
  })
})
