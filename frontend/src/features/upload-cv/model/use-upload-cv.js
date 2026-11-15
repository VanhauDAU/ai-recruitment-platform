import { useState } from 'react'
import { cvApiErrorMessage, importCvFile } from '@/entities/cv'
import { getUploadStatePresentation } from '@/shared/api/upload-session'
import { cvFileProblem } from './cv-upload-standards'

export function useUploadCv({ onUploaded }) {
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadState, setUploadState] = useState(null)

  const choose = (nextFile) => {
    const problem = cvFileProblem(nextFile)
    setError(problem)
    setFile(problem ? null : nextFile)
  }

  const submit = async () => {
    if (!file || uploading) return
    setUploading(true)
    setError('')
    try {
      const cv = await importCvFile(file, '', { onUploadStateChange: setUploadState })
      onUploaded(cv)
    } catch (uploadError) {
      setError(cvApiErrorMessage(uploadError, 'Không thể tải CV lên. Vui lòng thử lại.'))
    } finally {
      setUploading(false)
      setUploadState(null)
    }
  }

  return { file, error, uploading, uploadStatus: getUploadStatePresentation(uploadState), choose, submit }
}
