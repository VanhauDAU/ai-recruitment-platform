import { useContext } from 'react'
import JobComparisonContext from './comparison-context'

export default function useJobComparison() {
  return useContext(JobComparisonContext)
}
