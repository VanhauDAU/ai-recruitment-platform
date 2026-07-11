import { createContext } from 'react'

// Mở popup đăng nhập ngay tại trang hiện tại (không điều hướng sang /login),
// để mọi hành động cần đăng nhập giữ nguyên ngữ cảnh trang. Xem LoginPromptProvider.
const LoginPromptContext = createContext(null)

export default LoginPromptContext
