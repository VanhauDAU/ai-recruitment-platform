import { waitFor } from '@testing-library/react'

// Truy vấn trong phạm vi một dòng antd Table (`rowKey` → `data-row-key`).
// `getByRole` trên toàn trang phải tính computed style của mọi node trước CSS
// mà antd chèn vào, tốn hàng giây trong jsdom; thu phạm vi về một dòng rồi mới
// dùng `within(row).getByRole(...)` giữ nguyên kiểm tra truy cập mà nhanh.
export function getTableRow(rowKey) {
  const row = document.querySelector(`tr[data-row-key="${rowKey}"]`)
  if (!row) throw new Error(`Không thấy dòng bảng có data-row-key="${rowKey}"`)
  return row
}

export const findTableRow = (rowKey) => waitFor(() => getTableRow(rowKey))
