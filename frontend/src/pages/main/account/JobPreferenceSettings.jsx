import { useEffect, useState } from 'react'
import { getCandidateJobPreferences } from '@/entities/candidate-preferences'
import { JobPreferencesForm } from '@/features/configure-job-preferences'
import { useSession } from '@/entities/session'
import PageLoading from '@/shared/ui/PageLoading'

export default function JobPreferenceSettings() {
  const { setCurrentUser, user } = useSession()
  const [preference, setPreference] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getCandidateJobPreferences()
      .then((data) => { if (active) setPreference(data) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading) return <PageLoading />

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h1 className="text-lg font-bold text-slate-900 sm:text-xl">Cài đặt gợi ý việc làm</h1>
      <p className="mt-1 text-sm text-slate-500">Cập nhật nhu cầu để nhận các gợi ý phù hợp hơn.</p>
      <div className="mt-6 max-w-2xl">
        <JobPreferencesForm
          preference={preference}
          submitLabel="Lưu cài đặt"
          onSaved={(saved) => {
            setPreference(saved)
            setCurrentUser({ ...user, job_preferences_configured: saved.job_preferences_configured })
          }}
        />
      </div>
    </section>
  )
}
