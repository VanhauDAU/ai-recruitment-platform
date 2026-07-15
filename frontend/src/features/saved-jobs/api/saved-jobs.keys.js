// Query keys cho saved-jobs, scoped theo candidate để không lẫn cache giữa phiên.
export const savedJobsKeys = {
  list: (candidateKey) => ['saved-jobs', candidateKey],
}
