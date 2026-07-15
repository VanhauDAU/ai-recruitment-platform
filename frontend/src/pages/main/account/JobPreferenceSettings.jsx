import { useEffect, useState } from 'react'
import { Button } from 'antd'
import { getCandidateJobPreferences } from '@/entities/candidate-preferences'
import { getCandidateProfile, updateCandidateProfile } from '@/entities/candidate-profile'
import { JobPreferencesForm } from '@/features/configure-job-preferences'
import { useSession } from '@/entities/session'
import PageLoading from '@/shared/ui/PageLoading'

export default function JobPreferenceSettings() {
  const { setCurrentUser, user } = useSession()
  const [preference, setPreference] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    Promise.all([getCandidateJobPreferences(), getCandidateProfile()])
      .then(([preferenceData, profileData]) => {
        if (!active) return
        setPreference(preferenceData)
        setProfile(profileData)
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading) return <PageLoading />

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative overflow-hidden bg-gradient-to-r from-[#0d3240] via-[#06734e] to-[#02b94e] px-5 py-5 text-white sm:px-7">
        <div className="absolute -right-10 -top-14 h-40 w-40 rounded-full border-[20px] border-emerald-300/20" />
        <div className="absolute right-14 top-4 h-7 w-7 rotate-12 rounded-md bg-amber-300/90 shadow-lg" />
        <div className="relative max-w-xl">
          <img src="/images/logo/logo-full.webp" alt="TopCV" className="h-7 w-auto brightness-0 invert" />
          <p className="mt-3 text-sm font-bold">Tại sao bạn nên cập nhật thông tin gợi ý việc làm?</p>
          <ul className="mt-2 space-y-1 text-xs text-white/90"><li>✓ Được nhà tuyển dụng chủ động săn đón.</li><li>✓ Được gợi ý các cơ hội việc làm phù hợp.</li></ul>
        </div>
      </div>
      <div className="p-4 sm:p-6">
        <h1 className="text-base font-bold text-slate-800">Bạn vui lòng hoàn thiện các thông tin dưới đây</h1>
        <p className="mt-1 text-xs text-red-500">(*) Các thông tin bắt buộc</p>
      <div className="mt-5 max-w-2xl sm:mt-6">
        <JobPreferencesForm
          preference={preference}
          profile={profile}
          variant="settings"
          submitLabel="Cập nhật"
          renderFooter={({ saving, catalogLoading }) => (
            <div className="mt-6 flex justify-center border-t border-slate-100 pt-5">
              <Button type="primary" htmlType="submit" size="large" loading={saving} disabled={catalogLoading} className="!h-10 !min-w-32 !rounded-md !font-semibold">Cập nhật</Button>
            </div>
          )}
          onProfileSaved={async (values) => {
            const savedProfile = await updateCandidateProfile(values)
            setProfile(savedProfile)
            return savedProfile
          }}
          onSaved={(saved) => {
            setPreference(saved)
            setCurrentUser({ ...user, job_preferences_configured: saved.job_preferences_configured })
          }}
        />
      </div>
      </div>
    </section>
  )
}
