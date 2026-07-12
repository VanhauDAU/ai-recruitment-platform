// Public entrypoint của app router, giữ từng trang jobs là route chunk riêng.
export const loadJobListPage = () => import('./pages/candidate/JobList')
export const loadJobDetailPage = () => import('./pages/candidate/JobDetail')
export const loadSavedJobsPage = () => import('./pages/candidate/SavedJobs')
