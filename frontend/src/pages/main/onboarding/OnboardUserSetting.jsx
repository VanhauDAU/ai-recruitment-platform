import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from 'antd'
import { getCandidateJobPreferences } from '@/entities/candidate-preferences'
import { JobPreferencesForm } from '@/features/configure-job-preferences'
import { useSession } from '@/entities/session'
import PageLoading from '@/shared/ui/PageLoading'
import { buildPersonalizedJobsUrl } from './model/personalized-jobs-url'
import PersonalizingScreen from './ui/PersonalizingScreen'
import ReadyScreen from './ui/ReadyScreen'

export default function OnboardUserSetting() {
  const { setCurrentUser, user } = useSession()
  const navigate = useNavigate()
  const [preference, setPreference] = useState(null)
  const [loading, setLoading] = useState(true)
  // Sau khi lưu: form -> personalizing (hiệu ứng chờ) -> ready (đếm ngược
  // rồi chuyển sang /viec-lam với bộ lọc dựng từ nhu cầu vừa lưu).
  const [phase, setPhase] = useState('form')
  const [savedPreference, setSavedPreference] = useState(null)

  useEffect(() => {
    let active = true
    getCandidateJobPreferences()
      .then((data) => { if (active) setPreference(data) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading) return <PageLoading />
  if (phase === 'personalizing') return <PersonalizingScreen onDone={() => setPhase('ready')} />
  if (phase === 'ready') return <ReadyScreen targetUrl={buildPersonalizedJobsUrl(savedPreference)} />

  return (
    <section className="mx-auto w-full max-w-4xl px-3 pb-8 pt-4 sm:px-6 sm:pb-10 sm:pt-7">
      <div className="mx-auto max-w-2xl text-center text-white">
        <h1 className="text-xl font-bold leading-snug sm:text-[26px]">Mô tả công việc mong muốn của bạn</h1>
        <p className="mt-2 text-sm leading-5 text-white/90 sm:text-base">Chúng tôi sẽ gợi ý việc làm, cá nhân hoá trải nghiệm dựa trên mong muốn của bạn!</p>
      </div>
      <div className="mt-4 rounded-2xl bg-white px-4 py-5 shadow-xl shadow-emerald-950/15 sm:mt-5 sm:px-8 sm:py-7">
        <JobPreferencesForm
          preference={preference}
          variant="onboarding"
          onSaved={(saved) => {
            setCurrentUser({ ...user, job_preferences_configured: saved.job_preferences_configured })
            setSavedPreference(saved)
            setPhase('personalizing')
          }}
          onSkip={() => navigate('/', { replace: true })}
          renderFooter={({ saving, catalogLoading, onSkip, isValid }) => (
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
              {onSkip && (
                <Button
                  size="large"
                  onClick={onSkip}
                  className="!h-12 !rounded-full !px-10 !font-semibold"
                >
                  Tôi sẽ hoàn thiện sau
                </Button>
              )}
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={saving}
                disabled={catalogLoading || !isValid}
                className={`!h-12 !rounded-full !px-12 !font-semibold ${
                  (!catalogLoading && isValid)
                    ? '!border-emerald-700 !bg-emerald-600 !text-white hover:!bg-emerald-700'
                    : '!border-slate-200 !bg-slate-100 !text-slate-400 cursor-not-allowed'
                }`}
              >
                Hoàn thành
              </Button>
            </div>
          )}
        />
      </div>
    </section>
  )
}
