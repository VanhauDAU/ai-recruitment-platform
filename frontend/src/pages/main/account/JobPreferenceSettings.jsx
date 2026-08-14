import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ReloadOutlined } from '@ant-design/icons'
import { Alert, Button } from 'antd'
import { getCandidateJobPreferences } from '@/entities/candidate-preferences'
import { getCandidateProfile, updateCandidateProfile } from '@/entities/candidate-profile'
import { jobKeys } from '@/entities/job'
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
      <div className="w-full overflow-hidden">
        <img
          src="/images/candidate/job-preference-banner.png"
          alt="Cập nhật thông tin gợi ý việc làm"
          className="h-auto w-full object-cover"
        />
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h1 className="text-base font-bold text-slate-800">Bạn vui lòng hoàn thiện các thông tin dưới đây</h1>
            <p className="mt-0.5 text-xs text-red-500">(*) Các thông tin bắt buộc</p>
          </div>
        </div>
        <div className="mt-4 max-w-3xl">
          <JobPreferencesForm
            preference={preference}
            profile={profile}
            variant="settings"
            submitLabel="Cập nhật"
            renderFooter={({ saving, catalogLoading }) => (
              <div className="mt-4 flex justify-center border-t border-slate-100 pt-4">
                <Button type="primary" htmlType="submit" size="middle" loading={saving} disabled={catalogLoading} className="!h-9 !min-w-32 !rounded-lg !font-semibold !bg-emerald-600 hover:!bg-emerald-700 !border-emerald-600">Cập nhật</Button>
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
              queryClient.removeQueries({ queryKey: jobKeys.inlineRecommendationsRoot })
            }}
          />
        </div>
      </div>
    </section>
  )
}
