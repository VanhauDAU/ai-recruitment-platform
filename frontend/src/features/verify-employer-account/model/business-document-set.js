import { uploadEmployerCompanyDocument } from '@/entities/employer-profile'

export function savedDocumentsFromResponse(response) {
  return (Array.isArray(response) ? response : [response]).filter(Boolean)
}

export function replaceCachedDocuments(cachedDocuments, savedDocuments, selectedMethod) {
  const savedIds = new Set(savedDocuments.map((document) => document.id))
  const savedTypes = new Set(selectedMethod
    ? ['business_registration', 'authorization_letter', 'identity_document']
    : savedDocuments.map((document) => document.doc_type))
  const currentDocuments = Array.isArray(cachedDocuments) ? cachedDocuments : []

  return [
    ...savedDocuments,
    ...currentDocuments.filter(
      (document) => document.update_request || (
        !savedIds.has(document.id) && !savedTypes.has(document.doc_type)
      ),
    ),
  ]
}

export function currentDocumentSet(documents) {
  const verificationDocuments = documents.filter(
    (document) => !document.update_request && document.is_current !== false,
  )
  const business = verificationDocuments.filter(
    (document) => document.doc_type === 'business_registration',
  )
  if (business.length) {
    return { method: 'business_registration', documents: business.slice(0, 1) }
  }

  const authorization = verificationDocuments.filter(
    (document) => document.doc_type === 'authorization_letter',
  )
  const identity = verificationDocuments.filter(
    (document) => document.doc_type === 'identity_document',
  )
  return authorization.length && identity.length
    ? { method: 'authorization_and_id', documents: [...authorization, ...identity] }
    : { method: null, documents: [] }
}

export function documentStatus(documents) {
  if (!documents.length) return null
  if (documents.some((document) => document.status === 'rejected')) return 'rejected'
  if (documents.some((document) => document.status === 'changes_requested')) {
    return 'changes_requested'
  }
  if (documents.some((document) => document.status === 'pending')) return 'pending'
  return 'approved'
}

export function filesFromUploadList(files) {
  return files.map((file) => file.originFileObj || file)
}

export async function uploadDocumentSet(docType, files, verificationMethod, options = {}) {
  const savedDocuments = []
  for (const [index, file] of files.entries()) {
    const documentOptions = {
      onUploadStateChange: options.onUploadStateChange,
      uploadSession: options.uploadSessions?.get(file),
    }
    if (index === 0 && verificationMethod) {
      documentOptions.verificationMethod = verificationMethod
    }
    if (index > 0) documentOptions.append = true
    const savedDocument = Object.values(documentOptions).some(Boolean)
      ? await uploadEmployerCompanyDocument(docType, file, documentOptions)
      : await uploadEmployerCompanyDocument(docType, file)
    savedDocuments.push(savedDocument)
  }
  return savedDocuments
}
