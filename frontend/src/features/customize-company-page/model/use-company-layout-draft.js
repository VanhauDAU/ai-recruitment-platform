import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { employerCompanyPageKeys, updateEmployerCompanyPageLayout } from '@/entities/employer-company-page'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

const LAYOUT_FIELDS = ['section_order', 'hidden_sections', 'accent', 'pinned_job_public_ids']
const STALE_CODE = 'COMPANY_PAGE_LAYOUT_STALE'
const STALE_NOTICE = 'Bố cục vừa được cập nhật ở nơi khác. Đã tải lại bản mới nhất, vui lòng thực hiện lại thay đổi.'
const LOCK_VERSION_ERROR = 'Phiên bản bố cục không hợp lệ. Vui lòng tải lại trang rồi thử lại.'

// 400 là `{field: [câu]}`; lỗi của `lock_version` có thể bằng tiếng Anh nên thay bằng câu chung.
function badRequestMessage(error) {
  const { lock_version: lockVersion, ...fields } = error.response.data || {}
  if (Object.keys(fields).length) return getApiErrorMessage({ response: { ...error.response, data: fields } }, 'Không thể lưu bố cục trang công ty.')
  return lockVersion ? LOCK_VERSION_ERROR : 'Không thể lưu bố cục trang công ty.'
}

// Tập khối ẩn không có thứ tự: bật rồi tắt lại một khối không tính là thay đổi.
function fieldSignature(field, value) {
  return JSON.stringify(field === 'hidden_sections' ? [...(value || [])].sort() : value)
}

/**
 * Bản nháp bố cục trang công ty. `page` là payload workspace; bản nháp có cùng
 * hình dạng với `page.layout` nên dùng thẳng cho bản xem trước. Lưu chỉ gửi
 * trường đã đổi kèm `lock_version` của bản mà nháp xuất phát.
 */
export function useCompanyLayoutDraft(page) {
  const queryClient = useQueryClient()
  const [base, setBase] = useState(page.layout)
  const [draft, setDraft] = useState(page.layout)
  // Tin vừa chọn từ ô tìm kiếm chưa có trong `page.pinned_jobs` cho tới khi lưu.
  const [pickedJobs, setPickedJobs] = useState([])
  const [notice, setNotice] = useState(null)
  const changed = LAYOUT_FIELDS.filter(
    (field) => fieldSignature(field, base[field]) !== fieldSignature(field, draft[field]),
  )
  const dirty = changed.length > 0

  function adopt(layout) {
    setBase(layout)
    setDraft(layout)
  }

  // Server có bản mới hơn (tải lại nền): theo bản đó khi không có thay đổi chưa
  // lưu. `lock_version` chỉ tăng, nên cache đến chậm sau khi lưu không kéo lùi nháp.
  if (!dirty && page.layout.lock_version > base.lock_version) adopt(page.layout)

  const mutation = useMutation({
    mutationFn: updateEmployerCompanyPageLayout,
    // Mọi phản hồi 200 thay nháp bằng bố cục server trả, kể cả khi `lock_version`
    // không tăng vì bản gửi lên không đổi gì.
    onSuccess: (nextPage) => {
      queryClient.setQueryData(employerCompanyPageKeys.page, nextPage)
      adopt(nextPage.layout)
      setNotice(null)
      message.success('Đã lưu bố cục trang công ty.')
    },
    onError: (error) => {
      const { status, data } = error?.response || {}
      if (status === 409 && data?.code === STALE_CODE) {
        if (data.layout) {
          queryClient.setQueryData(employerCompanyPageKeys.page, (current) => current && { ...current, layout: data.layout })
          adopt(data.layout)
        } else {
          setDraft(base)
        }
        setNotice({ type: 'warning', text: STALE_NOTICE })
      } else if (status === 403) {
        setDraft(base)
        setNotice({ type: 'error', text: getApiErrorMessage(error, 'Bạn không còn quyền tuỳ biến trang công ty.') })
      } else {
        message.error(status === 400 ? badRequestMessage(error) : getApiErrorMessage(error, 'Không thể lưu bố cục trang công ty.'))
        return
      }
      // Quyền hoặc tin ghim có thể đã đổi cùng lúc: tải lại toàn bộ workspace.
      queryClient.invalidateQueries({ queryKey: employerCompanyPageKeys.page })
    },
  })

  const knownJobs = [...(page.pinned_jobs || []), ...pickedJobs]

  return {
    draft,
    dirty,
    notice,
    saving: mutation.isPending,
    pinnedJobs: (draft.pinned_job_public_ids || []).map((publicId) => (
      knownJobs.find((job) => job.public_id === publicId) || { public_id: publicId, title: 'Tin tuyển dụng đã ghim' }
    )),
    update: (patch) => setDraft((current) => ({ ...current, ...patch })),
    pinJob(job) {
      setPickedJobs((current) => [...current.filter((item) => item.public_id !== job.public_id), job])
      setDraft((current) => (current.pinned_job_public_ids.includes(job.public_id)
        ? current
        : { ...current, pinned_job_public_ids: [...current.pinned_job_public_ids, job.public_id] }))
    },
    reset() {
      setDraft(base)
      setNotice(null)
    },
    save() {
      if (!dirty) return
      mutation.mutate({
        lock_version: base.lock_version,
        ...Object.fromEntries(changed.map((field) => [field, draft[field]])),
      })
    },
    dismissNotice: () => setNotice(null),
  }
}
