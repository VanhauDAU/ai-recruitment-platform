import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  getRecruiterVisibility,
  RECRUITER_VISIBILITY_QUERY_KEY,
  updateRecruiterVisibility,
} from '@/entities/job/candidate-preferences'
import { cvApiErrorMessage, setCvRecruiterSearchable } from '@/entities/cv/cv'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'

// CV khác của ứng viên đang bật tìm kiếm, đọc từ các danh sách CV đã tải.
function otherSearchableCv(queryClient, cv) {
  return queryClient
    .getQueriesData({ queryKey: ['my-cvs'] })
    .flatMap(([, data]) => (Array.isArray(data) ? data : []))
    .find((item) => item.recruiter_searchable && item.public_id !== cv.public_id)
}

/**
 * Bật/tắt cho NTD tìm thấy một CV; lần bật đầu tiên xin đồng ý ở mức hồ sơ. Mỗi ứng
 * viên chỉ có một CV được bật: bật CV này thì máy chủ tắt CV đang bật trước đó.
 */
export function useCvRecruiterSearch(cv, { source = 'cv_library' } = {}) {
  const queryClient = useQueryClient()
  const [enabled, setEnabled] = useState(Boolean(cv?.recruiter_searchable))
  const [updating, setUpdating] = useState(false)
  const [consentOpen, setConsentOpen] = useState(false)
  const consent = useQuery({ queryKey: RECRUITER_VISIBILITY_QUERY_KEY, queryFn: getRecruiterVisibility, staleTime: 60_000 })
  // Popup "Quản lý danh sách" có thể đổi cờ này ở nơi khác.
  useEffect(() => setEnabled(Boolean(cv?.recruiter_searchable)), [cv?.recruiter_searchable])

  async function save(next) {
    setUpdating(true)
    try {
      const replaced = next ? otherSearchableCv(queryClient, cv) : null
      const saved = await setCvRecruiterSearchable(cv.public_id, next)
      setEnabled(Boolean(saved.recruiter_searchable))
      queryClient.invalidateQueries({ queryKey: ['my-cvs'] })
      if (!next) message.success('Đã ẩn CV này khỏi tìm kiếm của NTD.')
      else if (replaced) message.success(m.candidate_recruiter_search_replaced({ title: replaced.title }))
      else message.success('NTD đã có thể tìm thấy CV này.')
    } catch (error) {
      message.error(cvApiErrorMessage(error, 'Không thể cập nhật quyền tìm kiếm CV lúc này.'))
    } finally {
      setUpdating(false)
    }
  }

  async function grantConsentAndEnable() {
    setUpdating(true)
    try {
      const saved = await updateRecruiterVisibility({
        enabled: true,
        confirmed: true,
        cv_public_id: cv.public_id,
        policy_version: consent.data?.policy_version || 'v1',
        source,
        source_path: window.location.pathname,
      })
      queryClient.setQueryData(RECRUITER_VISIBILITY_QUERY_KEY, saved)
      setConsentOpen(false)
    } catch {
      message.error('Không thể lưu sự đồng ý lúc này.')
      setUpdating(false)
      return
    }
    await save(true)
  }

  const setSearchable = (next) => {
    if (next && !consent.data?.enabled) setConsentOpen(true)
    else save(next)
  }

  return {
    enabled,
    busy: updating || consent.isLoading,
    setSearchable,
    consentModalProps: {
      open: consentOpen,
      loading: updating,
      onConfirm: grantConsentAndEnable,
      onCancel: () => setConsentOpen(false),
    },
  }
}
