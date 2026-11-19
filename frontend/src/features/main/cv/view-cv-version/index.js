import { createElement } from 'react'
import { getCvOwnerView, getSharedCv } from '@/entities/cv/cv'
import { OwnerCvVersionView, SharedCvVersionView, VIEWER_ACTION_CLASS } from './ui/CvVersionReadOnly'

export { VIEWER_ACTION_CLASS }

export function OwnerCvVersionPage({ publicId, renderActions }) {
  return createElement(OwnerCvVersionView, { publicId, loadOwnerView: getCvOwnerView, renderActions })
}

export function SharedCvVersionPage({ token }) {
  return createElement(SharedCvVersionView, { token, loadSharedView: getSharedCv })
}
