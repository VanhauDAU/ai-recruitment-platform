import { useContext } from 'react'
import SavedJobsContext from '../contexts/savedJobsContext'

const EMPTY = { items: [], savedIds: new Set(), loading: false, toggle: () => {}, isCandidate: false }

// Toàn bộ kho tin đã lưu — dùng cho panel danh sách và badge nút nổi.
export function useSavedJobs() {
  return useContext(SavedJobsContext) || EMPTY
}

// Trạng thái lưu của một tin: `const [saved, toggleSaved] = useSavedJob(job.public_id)`.
export function useSavedJob(publicId) {
  const { savedIds, toggle } = useSavedJobs()
  return [savedIds.has(publicId), () => toggle(publicId)]
}

export default useSavedJob
