import { useContext } from 'react'
import SavedJobsProvider from './model/SavedJobsProvider'
import SavedJobsContext from './model/saved-jobs-context'
import useSavedJobRecommendations from './model/use-saved-job-recommendations'

const EMPTY = {
  items: [],
  savedIds: new Set(),
  pendingJobIds: new Set(),
  loading: false,
  refreshing: false,
  error: null,
  loadError: null,
  toggleError: null,
  reload: () => {},
  toggle: () => {},
  isCandidate: false,
}

export { SavedJobsContext, SavedJobsProvider }
export {
  getSavedJobRecommendations,
  getSavedJobs,
  saveJob,
  unsaveJob,
} from './api/saved-jobs.api'
export { useSavedJobRecommendations }

export function useSavedJobs() {
  return useContext(SavedJobsContext) || EMPTY
}

export function useSavedJob(publicId, jobSnapshot) {
  const { savedIds, pendingJobIds, toggle } = useSavedJobs()
  return [
    savedIds.has(publicId),
    () => toggle(publicId, jobSnapshot),
    pendingJobIds.has(publicId),
  ]
}

export default useSavedJob
