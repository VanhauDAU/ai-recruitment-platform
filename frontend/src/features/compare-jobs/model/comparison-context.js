import { createContext } from 'react'

const EMPTY_COMPARISON = {
  announcement: '',
  canCompare: false,
  clearJobs: () => {},
  hasJob: () => false,
  isFull: false,
  items: [],
  maxJobs: 3,
  openPreferenceSettings: () => {},
  persistence: 'memory',
  removeJob: () => {},
  replaceJobs: () => {},
  toggleJob: () => 'invalid',
}

const JobComparisonContext = createContext(EMPTY_COMPARISON)

export default JobComparisonContext
