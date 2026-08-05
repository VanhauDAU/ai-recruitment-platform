import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { getCandidateJobPreferences } from '@/entities/candidate-preferences'
import { useSession } from '@/entities/session'
import { OnboardingChat } from '@/widgets/onboarding-interview'
import PageLoading from '@/shared/ui/PageLoading'
import { buildPersonalizedJobsUrl } from './model/personalized-jobs-url'

/**
 * Toàn bộ onboarding ứng viên nằm trên trang này: chào hỏi, năm câu phỏng vấn,
 * lưu nhu cầu rồi chốt — tất cả là một cuộc trò chuyện liền mạch với robot.
 */
export default function OnboardUser() {
  const { setCurrentUser, user } = useSession()
  const navigate = useNavigate()
  const [preference, setPreference] = useState(null)
  const [loading, setLoading] = useState(true)
  // Đích đến dựng từ nhu cầu vừa lưu; giữ ở ref vì chỉ đọc lúc rời trang.
  const targetRef = useRef('/viec-lam')

  useEffect(() => {
    let active = true
    getCandidateJobPreferences()
      .then((data) => { if (active) setPreference(data) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading) return <PageLoading />

  return (
    <OnboardingChat
      preference={preference}
      user={user}
      onSaved={(saved) => {
        setCurrentUser({ ...user, job_preferences_configured: saved.job_preferences_configured })
        targetRef.current = buildPersonalizedJobsUrl(saved)
      }}
      onFinish={() => navigate(targetRef.current, { replace: true })}
      onSkip={() => navigate('/', { replace: true })}
    />
  )
}
