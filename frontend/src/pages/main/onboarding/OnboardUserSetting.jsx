import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { getCandidateJobPreferences } from '@/entities/candidate-preferences'
import { useSession } from '@/entities/session'
import { OnboardingInterview } from '@/widgets/onboarding-interview'
import PageLoading from '@/shared/ui/PageLoading'
import { buildPersonalizedJobsUrl } from './model/personalized-jobs-url'
import PersonalizingScreen from './ui/PersonalizingScreen'
import ReadyScreen from './ui/ReadyScreen'

export default function OnboardUserSetting() {
  const { setCurrentUser, user } = useSession()
  const navigate = useNavigate()
  const [preference, setPreference] = useState(null)
  const [loading, setLoading] = useState(true)
  // Sau khi lưu: phỏng vấn -> personalizing (hiệu ứng chờ) -> ready (đếm ngược
  // rồi chuyển sang /viec-lam với bộ lọc dựng từ nhu cầu vừa lưu).
  const [phase, setPhase] = useState('interview')
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
  if (phase === 'ready') {
    return (
      <ReadyScreen
        preference={savedPreference}
        targetUrl={buildPersonalizedJobsUrl(savedPreference)}
        user={user}
      />
    )
  }

  return (
    <OnboardingInterview
      preference={preference}
      user={user}
      onSaved={(saved) => {
        setCurrentUser({ ...user, job_preferences_configured: saved.job_preferences_configured })
        setSavedPreference(saved)
        setPhase('personalizing')
      }}
      onSkip={() => navigate('/', { replace: true })}
    />
  )
}
