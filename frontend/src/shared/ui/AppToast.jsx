import { Toaster } from 'sonner'
import 'sonner/dist/styles.css'

export default function AppToast() {
  return (
    <Toaster
      closeButton
      duration={4500}
      expand
      gap={10}
      position="top-right"
      richColors
      toastOptions={{ className: 'app-toast' }}
      visibleToasts={3}
    />
  )
}
