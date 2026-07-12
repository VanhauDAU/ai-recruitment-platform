import { useContext } from 'react'
import SavedJobsProvider from './model/SavedJobsProvider'
import SavedJobsContext from './model/savedJobsContext'

const EMPTY = {
  items: [],
  savedIds: new Set(),
  loading: false,
  error: null,
  reload: () => {},
  toggle: () => {},
  isCandidate: false,
}

export { SavedJobsContext, SavedJobsProvider }

export function useSavedJobs() {
  return useContext(SavedJobsContext) || EMPTY
}

export function useSavedJob(publicId) {
  const { savedIds, toggle } = useSavedJobs()
  return [savedIds.has(publicId), () => toggle(publicId)]
}

export default useSavedJob
