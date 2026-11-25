/* oxlint-disable react/only-export-components -- Lazy route registry exports component values. */
import { lazy } from 'react'

export const NotFoundPage = lazy(() => import('@/pages/common/not-found/NotFound'))
