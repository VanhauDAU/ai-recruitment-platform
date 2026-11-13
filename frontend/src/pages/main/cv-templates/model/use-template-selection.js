import { useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { searchParamsFromSelection, selectionFromSearchParams } from './template-selection-params'

// Lựa chọn ở trang chi tiết mẫu (nguồn, vị trí, kinh nghiệm, ngôn ngữ, màu) có
// một nguồn sự thật duy nhất là query string: reload, chia sẻ link hay quay lại
// sau đăng nhập đều giữ nguyên. Ghi bằng `replace` để không làm đầy lịch sử.
export function useTemplateSelection(pathLocale, defaultColorSlug) {
  const [params, setParams] = useSearchParams()
  const defaultColor = useRef(defaultColorSlug)
  defaultColor.current = defaultColorSlug
  const selection = useMemo(() => selectionFromSearchParams(params, pathLocale), [params, pathLocale])
  const update = useCallback((patch) => {
    setParams((current) => {
      const next = searchParamsFromSelection(
        { ...selectionFromSearchParams(current, pathLocale), ...patch },
        { pathLocale, defaultColorSlug: defaultColor.current },
      )
      return next.toString() === current.toString() ? current : next
    }, { replace: true })
  }, [setParams, pathLocale])
  return { selection, update, hasQuery: params.toString() !== '' }
}
