import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { ManageJobAlerts, jobAlertPrefillFromSearchParams } from '@/features/manage-job-alerts'

export default function JobAlertSettings() {
  const [searchParams] = useSearchParams()
  const prefillKey = searchParams.toString()
  const initialCreateValues = useMemo(
    () => jobAlertPrefillFromSearchParams(new URLSearchParams(prefillKey)),
    [prefillKey],
  )

  return (
    <ManageJobAlerts
      openCreateOnMount={searchParams.get('create') === '1'}
      initialCreateValues={initialCreateValues}
    />
  )
}
