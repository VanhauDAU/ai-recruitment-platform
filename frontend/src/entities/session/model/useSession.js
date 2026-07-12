import { useContext } from 'react'
import SessionContext from './session-context'

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useSession must be used within SessionProvider')
  return context
}
