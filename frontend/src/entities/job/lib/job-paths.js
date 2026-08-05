// V1 có đúng một URL canonical cho mọi tin. Route /brand/... vẫn được router và
// SEO shell giữ tương thích, nhưng không còn được sản phẩm sinh link mới.
export function jobDetailPath(job) {
  if (!job?.slug) return '/viec-lam'
  return `/viec-lam/${job.slug}`
}

export default jobDetailPath
