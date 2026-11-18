import { useContext } from 'react'
import LoginPromptContext from './login-prompt-context'

// `const { promptLogin } = useLoginPrompt()` — mở popup đăng nhập tại chỗ.
// Fallback no-op nếu dùng ngoài LoginPromptProvider (vd. trong test).
export function useLoginPrompt() {
  return useContext(LoginPromptContext) || { promptLogin: () => {} }
}

export default useLoginPrompt
