import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FittedCvPreview from './FittedCvPreview'

vi.mock('./CvDocumentPreview', () => ({ default: () => <div data-testid="page" /> }))

let width = 0
let notify = () => {}
class FakeResizeObserver {
  constructor(callback) { notify = callback }
  observe() {}
  disconnect() {}
}

function mount(initialWidth) {
  width = initialWidth
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width)
  const view = render(<FittedCvPreview document={{}} rendererKey="single_column_v1" />)
  const zoom = () => Number(view.getByTestId('page').parentElement.style.zoom)
  const resize = (next) => act(() => { width = next; notify() })
  return { zoom, resize }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('FittedCvPreview', () => {
  it('fits the A4 page to the container width', () => {
    const { zoom, resize } = mount(397)
    expect(zoom()).toBe(0.5)
    resize(2000)
    expect(zoom()).toBe(1)
  })

  it('ignores the parent scrollbar appearing and disappearing so the preview does not jitter', () => {
    const { zoom, resize } = mount(400)
    const fitted = zoom()

    resize(415) // thanh cuộn của khung cha biến mất
    expect(zoom()).toBe(fitted)
    resize(400) // thanh cuộn hiện lại
    expect(zoom()).toBe(fitted)
    resize(300) // khung thật sự hẹp lại
    expect(zoom()).toBeLessThan(fitted)
  })
})
