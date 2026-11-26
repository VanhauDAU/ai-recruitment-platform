import { useMediaQuery } from './use-media-query'

const NEW_TAB = Object.freeze({ target: '_blank', rel: 'noopener' })
const SAME_TAB = Object.freeze({})

/**
 * Thuộc tính mở link sang tab mới chỉ cho máy có chuột: trên điện thoại tab mới không
 * có lịch sử để quay lại, còn web app toàn màn hình (manifest standalone) bị đẩy ra Safari.
 */
export function useNewTabLinkProps() {
  return useMediaQuery('(hover: hover) and (pointer: fine)') ? NEW_TAB : SAME_TAB
}
