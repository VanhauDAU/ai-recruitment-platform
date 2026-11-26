import { act, render, screen } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { beforeEach, expect, it, vi } from 'vitest'
import CvEditor from './CvEditor'

const lifecycle = vi.hoisted(() => ({
  mounts: [],
  unmounts: [],
}))

vi.mock('@/features/common/cv/edit-cv-draft', async () => {
  const React = await import('react')
  return {
    CvDraftEditor: ({ publicId }) => {
      const resourceAtMount = React.useRef(publicId)
      React.useEffect(() => {
        const mountedResource = resourceAtMount.current
        lifecycle.mounts.push(mountedResource)
        return () => lifecycle.unmounts.push(mountedResource)
      }, [])
      return React.createElement('p', null, `Editor ${publicId}`)
    },
  }
})

beforeEach(() => {
  lifecycle.mounts.length = 0
  lifecycle.unmounts.length = 0
})

it('remounts editor state when the route changes to another CV resource', async () => {
  const router = createMemoryRouter(
    [{ path: '/cv/:publicId/chinh-sua', element: <CvEditor /> }],
    { initialEntries: ['/cv/cv_a/chinh-sua'] },
  )
  render(<RouterProvider router={router} />)
  await screen.findByText('Editor cv_a')

  await act(() => router.navigate('/cv/cv_b/chinh-sua'))

  expect(await screen.findByText('Editor cv_b')).toBeInTheDocument()
  expect(lifecycle.mounts).toEqual(['cv_a', 'cv_b'])
  expect(lifecycle.unmounts).toEqual(['cv_a'])
})
