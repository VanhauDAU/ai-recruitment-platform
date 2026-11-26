import { useMutation, useQueryClient } from '@tanstack/react-query'
import { employerCompanyPageKeys, getEmployerCompanyPage, submitEmployerCompanyPageContent } from '@/entities/company/employer-company-page'
import {
  uploadEmployerCompanyCover,
  uploadEmployerCompanyImage,
  uploadEmployerCompanyLogo,
} from '@/entities/account/employer-profile'

/**
 * Lưu nội dung của một thẻ: đăng ngay (trả `content_change`) hoặc, khi công ty bị
 * duyệt trước, gộp vào yêu cầu cập nhật đang mở. Ảnh đi hai bước: POST nội dung
 * kèm cờ `*_pending`, rồi tải từng ảnh vào `content_change` (hoặc
 * `content_form.request.public_id`) và đọc lại workspace.
 * `submission` là `{ changes, files: { logo?, cover?, gallery?: File[] } }`.
 */
export function useCompanyContentSubmit() {
  const queryClient = useQueryClient()
  const setPage = (page) => queryClient.setQueryData(employerCompanyPageKeys.page, page)

  return useMutation({
    mutationFn: async ({ changes, files = {} }) => {
      const gallery = files.gallery || []
      const { content_change: contentChange, ...page } = await submitEmployerCompanyPageContent({
        ...changes,
        ...(files.logo ? { logo_pending: true } : {}),
        ...(files.cover ? { cover_pending: true } : {}),
        ...(gallery.length ? { gallery_pending: true } : {}),
      })
      setPage(page)
      const slots = [
        files.logo && [uploadEmployerCompanyLogo, files.logo],
        files.cover && [uploadEmployerCompanyCover, files.cover],
      ].filter(Boolean)
      if (!slots.length && !gallery.length) return page

      const target = contentChange ? { contentChange } : { updateRequest: page.content_form?.request?.public_id }
      try {
        // Logo và ảnh bìa tải song song (server khoá thay đổi khi ghi); ảnh thư viện
        // đi lần lượt để giữ đúng thứ tự đã chọn.
        await Promise.all(slots.map(([upload, file]) => upload(file, target)))
        for (const file of gallery) await uploadEmployerCompanyImage(file, target)
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
