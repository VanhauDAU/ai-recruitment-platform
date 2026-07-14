import { createElement } from 'react'
import { getCvOwnerView, getSharedCv } from '@/entities/cv'
import { OwnerCvVersionView, SharedCvVersionView } from './ui/CvVersionReadOnly'

export function OwnerCvVersionPage({ publicId }) {
  return createElement(OwnerCvVersionView, { publicId, loadOwnerView: getCvOwnerView })
}

export function SharedCvVersionPage({ token }) {
  return createElement(SharedCvVersionView, { token, loadSharedView: getSharedCv })
}
