import { useJobImpression } from '../model/use-job-impression'

export default function JobImpressionBoundary({ as: Component = 'div', slug, ...props }) {
  const impressionRef = useJobImpression(slug)
  return <Component ref={impressionRef} {...props} />
}
