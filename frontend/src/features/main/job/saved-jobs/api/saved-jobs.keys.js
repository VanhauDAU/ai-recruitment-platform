// Query keys cho saved-jobs, scoped theo candidate để không lẫn cache giữa phiên.
export const savedJobsKeys = {
  list: (candidateKey) => ['saved-jobs', candidateKey],
  recommendations: (candidateKey, limit) => [
    'saved-jobs',
    candidateKey,
    'recommendations',
    ...(limit ? [limit] : []),
  ],
}
