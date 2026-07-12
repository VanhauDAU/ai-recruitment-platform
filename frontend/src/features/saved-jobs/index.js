import { useContext } from 'react'
import SavedJobsProvider from './model/SavedJobsProvider'
import SavedJobsContext from './model/saved-jobs-context'

const EMPTY = {
  items: [],
  savedIds: new Set(),
  pendingJobIds: new Set(),
  loading: false,
  error: null,
  reload: () => {},
  toggle: () => {},
  isCandidate: false,
}

export { SavedJobsContext, SavedJobsProvider }
export { getSavedJobs, saveJob, unsaveJob } from './api/saved-jobs.api'

export function useSavedJobs() {
  return useContext(SavedJobsContext) || EMPTY
}

export function useSavedJob(publicId) {
  const { savedIds, pendingJobIds, toggle } = useSavedJobs()
  return [savedIds.has(publicId), () => toggle(publicId), pendingJobIds.has(publicId)]
}

export default useSavedJob
