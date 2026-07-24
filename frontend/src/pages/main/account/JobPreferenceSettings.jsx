import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ReloadOutlined } from '@ant-design/icons'
import { Alert, Button } from 'antd'
import { getCandidateJobPreferences } from '@/entities/candidate-preferences'
import { getCandidateProfile, updateCandidateProfile } from '@/entities/candidate-profile'
import { jobKeys } from '@/entities/job'
import { BrandLogo } from '@/entities/site-settings'
import { JobPreferencesForm } from '@/features/configure-job-preferences'
import { useSession } from '@/entities/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import PageLoading from '@/shared/ui/PageLoading'

export default function JobPreferenceSettings() {
  const { setCurrentUser, user } = useSession()
  const queryClient = useQueryClient()
  const [preference, setPreference] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadVersion, setReloadVersion] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError('')
    Promise.all([getCandidateJobPreferences(), getCandidateProfile()])
      .then(([preferenceData, profileData]) => {
        if (!active) return
        setPreference(preferenceData)
        setProfile(profileData)
      })
      .catch((error) => {
        if (!active) return
        setLoadError(getApiErrorMessage(
          error,
          'Không thể tải cài đặt gợi ý việc làm. Vui lòng thử lại.',
        ))
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reloadVersion])

  if (loading) return <PageLoading />
  if (loadError) {
    return (
      <Alert
        showIcon
        type="error"
        title="Chưa tải được cài đặt gợi ý việc làm"
        description={loadError}
        action={(
          <Button
            aria-label="Thử lại"
            icon={<ReloadOutlined />}
            onClick={() => setReloadVersion((version) => version + 1)}
          >
            Thử lại
          </Button>
        )}
      />
    )
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative overflow-hidden bg-gradient-to-r from-[#0d3240] via-[#06734e] to-[#02b94e] px-5 py-5 text-white sm:px-7">
        <div className="absolute -right-10 -top-14 h-40 w-40 rounded-full border-[20px] border-emerald-300/20" />
        <div className="absolute right-14 top-4 h-7 w-7 rotate-12 rounded-md bg-amber-300/90 shadow-lg" />
        <div className="relative max-w-xl">
          <BrandLogo
            dark
            imageClassName="h-7 max-w-[150px] brightness-0 invert"
            textClassName="text-white"
          />
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
            queryClient.removeQueries({ queryKey: jobKeys.candidateRecommendationsRoot })
          }}
        />
      </div>
      </div>
    </section>
  )
}
