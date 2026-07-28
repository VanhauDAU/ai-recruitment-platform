export function isBlogRevisionConflict(error) {
  return (
    error?.response?.status === 409
    && error.response?.data?.code === 'blog_resource_changed'
  )
}
