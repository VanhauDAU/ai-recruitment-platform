import { useMutation, useQueryClient } from '@tanstack/react-query'
import { employerCompanyPageKeys, getEmployerCompanyPage, submitEmployerCompanyPageContent } from '@/entities/employer-company-page'
import {
  uploadEmployerCompanyCover,
  uploadEmployerCompanyImage,
  uploadEmployerCompanyLogo,
} from '@/entities/employer-profile'

/**
 * Gửi nội dung của một thẻ vào yêu cầu cập nhật đang mở. Ảnh đi hai bước: POST
 * nội dung kèm cờ `*_pending` để có `content_form.request.public_id`, rồi tải
 * từng ảnh với `update_request` đó và đọc lại workspace.
 * `submission` là `{ changes, files: { logo?, cover?, gallery?: File[] } }`.
 */
export function useCompanyContentSubmit() {
  const queryClient = useQueryClient()
  const setPage = (page) => queryClient.setQueryData(employerCompanyPageKeys.page, page)

  return useMutation({
    mutationFn: async ({ changes, files = {} }) => {
      const gallery = files.gallery || []
      const page = await submitEmployerCompanyPageContent({
        ...changes,
        ...(files.logo ? { logo_pending: true } : {}),
        ...(files.cover ? { cover_pending: true } : {}),
        ...(gallery.length ? { gallery_pending: true } : {}),
      })
      setPage(page)
      const uploads = [
        files.logo && [uploadEmployerCompanyLogo, files.logo],
        files.cover && [uploadEmployerCompanyCover, files.cover],
        ...gallery.map((file) => [uploadEmployerCompanyImage, file]),
      ].filter(Boolean)
      if (!uploads.length) return page

      const updateRequest = page.content_form?.request?.public_id
      try {
        for (const [upload, file] of uploads) await upload(file, { updateRequest })
      } catch (cause) {
        throw Object.assign(new Error('Company media upload failed.'), { mediaFailed: true, cause })
      }
      return queryClient.fetchQuery({
        queryKey: employerCompanyPageKeys.page,
        queryFn: ({ signal }) => getEmployerCompanyPage({ signal }),
        staleTime: 0,
      })
    },
    onSuccess: setPage,
    onError: (error) => {
      // Trạng thái yêu cầu hoặc quyền đã đổi ở server: đọc lại để khoá form đúng.
      if (error?.mediaFailed || [403, 409].includes(error?.response?.status)) {
        queryClient.invalidateQueries({ queryKey: employerCompanyPageKeys.page })
      }
    },
  })
}
