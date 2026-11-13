// Entry trang in PDF: Celery worker nạp trang này bằng Chromium headless, gọi
// window.renderCvPrint(payload) và in A4. Dùng đúng CvDocumentPreview của preview
// và editor nên PDF khớp tuyệt đối với những gì ứng viên thấy.
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { CvDocumentPreview } from '@/entities/cv'
import '../../index.css'
import './cv-print.css'

const root = createRoot(document.getElementById('root'))

// Phân trang đo DOM sau khi render nên số trang có thể đổi vài khung hình đầu.
function waitForStableLayout() {
  return new Promise((resolve) => {
    let previous = ''
    let stableFrames = 0
    const check = () => {
      const signature = `${document.querySelectorAll('[data-cv-page]').length}:${document.body.scrollHeight}`
      stableFrames = signature === previous ? stableFrames + 1 : 0
      previous = signature
      if (stableFrames >= 3) resolve()
      else requestAnimationFrame(check)
    }
    requestAnimationFrame(check)
  })
}

function waitForImages() {
  return Promise.all([...document.images].map((image) => (image.complete ? null : new Promise((resolve) => {
    image.addEventListener('load', resolve, { once: true })
    image.addEventListener('error', resolve, { once: true })
  }))))
}

window.renderCvPrint = async ({ document: cvDocument, renderer_key: rendererKey, assets = {} }) => {
  flushSync(() => {
    root.render(<CvDocumentPreview document={cvDocument} rendererKey={rendererKey} assets={assets} editorChrome={false} pageLabelVariant="none" />)
  })
  await document.fonts.ready
  await waitForImages()
  await waitForStableLayout()
  return document.querySelectorAll('[data-cv-page]').length
}
