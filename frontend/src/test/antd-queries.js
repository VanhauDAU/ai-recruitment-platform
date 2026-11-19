import { waitFor, within } from '@testing-library/react'

// Truy vấn nhanh cho màn hình antd trong jsdom.
//
// `getByRole`/`getByLabelText` kiểm phần tử có bị ẩn không bằng cách tính
// computed style của nó và MỌI tổ tiên tới <body>, trước toàn bộ CSS antd chèn
// vào trang — mỗi truy vấn có thể mất hàng giây (đã đo 2,4–2,7s). `within(...)`
// không tránh được bước duyệt tổ tiên đó. Hai helper dưới đây đi thẳng tới phần
// tử qua dữ liệu antd render sẵn; vẫn dùng `getByRole` khi chính vai trò hoặc
// khả năng truy cập là điều cần kiểm.

/** Dòng antd Table theo `rowKey` (antd ghi ra `data-row-key`). */
export function getTableRow(rowKey) {
  const row = document.querySelector(`tr[data-row-key="${rowKey}"]`)
  if (!row) throw new Error(`Không thấy dòng bảng có data-row-key="${rowKey}"`)
  return row
}

export const findTableRow = (rowKey) => waitFor(() => getTableRow(rowKey))

/** Nút có đúng nhãn `text` trong `container` (antd bọc nhãn trong <span>). */
export function getButtonByText(container, text) {
  const button = within(container).getByText(text).closest('button')
  if (!button) throw new Error(`"${text}" không nằm trong một <button>`)
  return button
}
