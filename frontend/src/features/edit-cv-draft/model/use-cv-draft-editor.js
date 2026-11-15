import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createDocumentHistory,
  applyCvSample,
  ensureBasicEditorDocument,
  getCv,
  getCvDraft,
  publishCvVersion,
  renameCv,
  updateCvProfile,
  recordDocumentCommand,
  redoDocumentCommand,
  saveCvVersion,
  switchCvTemplate,
  undoDocumentCommand,
  updateCvDraft,
  validateCvDocument,
} from '@/entities/cv'
import { useUnsavedChangesGuard } from './use-unsaved-changes-guard'

function signature(document) {
  return JSON.stringify(document)
}

function sessionId() {
  return globalThis.crypto?.randomUUID?.() || `cv-editor-${Date.now()}`
}

export default function useCvDraftEditor(publicId) {
  const [document, setDocument] = useState(null)
  const [cv, setCv] = useState(null)
  const [phase, setPhaseState] = useState('loading')
  const [error, setError] = useState(null)
  const [lastVersion, setLastVersion] = useState(null)
  const [validationErrors, setValidationErrors] = useState([])
  const [assets, setAssets] = useState({})
  const [savedAt, setSavedAt] = useState(null)
  const [history, setHistoryState] = useState(() => createDocumentHistory())
  const documentRef = useRef(null)
  const lockVersionRef = useRef(null)
  const lastSavedSignatureRef = useRef(null)
  const inFlightRef = useRef(null)
  const phaseRef = useRef('loading')
  const clientSessionIdRef = useRef(sessionId())
  const historyRef = useRef(createDocumentHistory())
  const loadGenerationRef = useRef(0)
  const pendingEditFlushersRef = useRef(new Set())

  const flushPendingEdits = useCallback(() => {
    for (const flush of [...pendingEditFlushersRef.current]) flush()
    // Field commits update documentRef synchronously, while React state updates
    // on the next render. Consumers opening a modal need this newest snapshot.
    return documentRef.current
  }, [])

  const registerPendingEdit = useCallback((flush) => {
    pendingEditFlushersRef.current.add(flush)
    return () => pendingEditFlushersRef.current.delete(flush)
  }, [])

  const setSavePhase = useCallback((nextPhase) => {
    phaseRef.current = nextPhase
    setPhaseState(nextPhase)
  }, [])

  // Chỉ chạy khi người dùng lưu (hoặc trước thao tác cần bản nháp mới nhất trên
  // máy chủ): editor không còn tự động lưu sau mỗi lần sửa.
  const persistDraft = useCallback(() => {
    if (inFlightRef.current) return inFlightRef.current
    if (!documentRef.current || phaseRef.current === 'conflict') return Promise.resolve(false)
    const snapshot = documentRef.current
    const snapshotSignature = signature(snapshot)
    if (snapshotSignature === lastSavedSignatureRef.current) return Promise.resolve(true)

    setError(null)
    setSavePhase('saving')
    const request = updateCvDraft(
      publicId,
      snapshot,
      lockVersionRef.current,
      clientSessionIdRef.current,
    ).then((draft) => {
      lockVersionRef.current = draft.lock_version
      lastSavedSignatureRef.current = snapshotSignature
      if (draft.assets) setAssets((current) => ({ ...current, ...draft.assets }))
      setSavedAt(new Date())
      const hasNewerChanges = signature(documentRef.current) !== snapshotSignature
      setSavePhase(hasNewerChanges ? 'unsaved' : 'saved')
      return true
    }).catch((saveError) => {
      if (saveError.response?.status === 409) {
        setError(saveError.response.data)
        setSavePhase('conflict')
      } else {
        setError(saveError)
        setSavePhase('failed')
      }
      return false
    }).finally(() => {
      if (inFlightRef.current === request) inFlightRef.current = null
    })
    inFlightRef.current = request
    return request
  }, [publicId, setSavePhase])

  const load = useCallback(async () => {
    const generation = ++loadGenerationRef.current
    setSavePhase('loading')
    setError(null)
    setLastVersion(null)
    setValidationErrors([])
    try {
      const [nextCv, draft] = await Promise.all([getCv(publicId), getCvDraft(publicId)])
      if (generation !== loadGenerationRef.current) return
      const rawDocument = {
        schema_version: draft.schema_version,
        content_json: draft.content_json,
        layout_json: draft.layout_json,
        style_json: draft.style_json,
      }
      const normalized = ensureBasicEditorDocument(rawDocument)
      // Bản nháp cũ thiếu cấu trúc cơ bản được chuẩn hóa và đồng bộ một lần.
      const needsNormalizationSync = signature(normalized) !== signature(rawDocument)
      documentRef.current = normalized
      lockVersionRef.current = draft.lock_version
      lastSavedSignatureRef.current = needsNormalizationSync ? signature(rawDocument) : signature(normalized)
      setDocument(normalized)
      setCv(nextCv)
      setAssets(draft.assets || {})
      setSavedAt(draft.updated_at ? new Date(draft.updated_at) : null)
      const nextHistory = createDocumentHistory()
      historyRef.current = nextHistory
      setHistoryState(nextHistory)
      setSavePhase(needsNormalizationSync ? 'unsaved' : 'saved')
      if (needsNormalizationSync) persistDraft()
    } catch (loadError) {
      if (generation !== loadGenerationRef.current) return
      setError(loadError)
      setSavePhase('failed')
    }
  }, [persistDraft, publicId, setSavePhase])

  useEffect(() => { load() }, [load])

  useUnsavedChangesGuard({
    documentRef,
    lastSavedSignatureRef,
    phaseRef,
    signature,
    flushPendingEdits,
  })

  const updateDocument = useCallback((updater, commandLabel = 'Cập nhật CV', options = {}) => {
    if (phaseRef.current === 'conflict') return
    const current = documentRef.current
    if (!current) return
    const next = typeof updater === 'function' ? updater(current) : updater
    if (signature(current) === signature(next)) return
    const nextHistory = recordDocumentCommand(historyRef.current, current, next, commandLabel, undefined, options)
    historyRef.current = nextHistory
    setHistoryState(nextHistory)
    documentRef.current = next
    setDocument(next)
    setValidationErrors([])
    setSavePhase('unsaved')
  }, [setSavePhase])

  const undo = useCallback(() => {
    flushPendingEdits()
    if (phaseRef.current === 'conflict') return
    const result = undoDocumentCommand(historyRef.current)
    if (!result.document) return
    historyRef.current = result.history
    setHistoryState(result.history)
    documentRef.current = result.document
    setDocument(result.document)
    setValidationErrors([])
    setSavePhase('unsaved')
  }, [flushPendingEdits, setSavePhase])

  const redo = useCallback(() => {
    flushPendingEdits()
    if (phaseRef.current === 'conflict') return
    const result = redoDocumentCommand(historyRef.current)
    if (!result.document) return
    historyRef.current = result.history
    setHistoryState(result.history)
    documentRef.current = result.document
    setDocument(result.document)
    setValidationErrors([])
    setSavePhase('unsaved')
  }, [flushPendingEdits, setSavePhase])

  const retrySave = useCallback(async () => {
    if (phaseRef.current === 'conflict') return Promise.resolve(false)
    setSavePhase('unsaved')
    const saved = await persistDraft()
    if (saved && signature(documentRef.current) === lastSavedSignatureRef.current) {
      setError(null)
      setSavePhase('saved')
    }
    return saved
  }, [persistDraft, setSavePhase])

  const saveDraft = useCallback(async () => {
    flushPendingEdits()
    if (phaseRef.current === 'conflict') return false

    // If a save was already in flight, wait for it and persist any newer
    // canvas edits before reporting that the explicit save has completed.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const saved = await persistDraft()
      if (!saved) return false
      if (signature(documentRef.current) === lastSavedSignatureRef.current) return true
    }
    return false
  }, [flushPendingEdits, persistDraft])

  const commitVersion = useCallback(async (publish) => {
    flushPendingEdits()
    if (phaseRef.current === 'conflict') return null
    const nextValidationErrors = validateCvDocument(documentRef.current)
    if (nextValidationErrors.length) {
      setValidationErrors(nextValidationErrors)
      return null
    }
    const didPersist = await persistDraft()
    if (!didPersist) return null
    setError(null)
    try {
      const version = await (publish ? publishCvVersion : saveCvVersion)(publicId, lockVersionRef.current)
      setLastVersion(version)
      setSavedAt(new Date())
      setSavePhase('saved')
      return version
    } catch (saveError) {
      if (saveError.response?.status === 409) {
        setError(saveError.response.data)
        setSavePhase('conflict')
      } else {
        setError(saveError)
        setSavePhase('failed')
      }
      return null
    }
  }, [flushPendingEdits, publicId, persistDraft, setSavePhase])

  const switchTemplate = useCallback(async (templatePublicId) => {
    flushPendingEdits()
    if (phaseRef.current === 'conflict' || !templatePublicId) return null
    const didPersist = await persistDraft()
    if (!didPersist) return null
    setError(null)
    setSavePhase('saving')
    try {
      const result = await switchCvTemplate(
        publicId,
        templatePublicId,
        lockVersionRef.current,
        clientSessionIdRef.current,
      )
      const nextDocument = {
        schema_version: result.draft.schema_version,
        content_json: result.draft.content_json,
        layout_json: result.draft.layout_json,
        style_json: result.draft.style_json,
      }
      documentRef.current = nextDocument
      lockVersionRef.current = result.draft.lock_version
      lastSavedSignatureRef.current = signature(nextDocument)
      setDocument(nextDocument)
      setCv(result.cv)
      setAssets(result.draft.assets || {})
      setSavedAt(new Date())
      const nextHistory = createDocumentHistory()
      historyRef.current = nextHistory
      setHistoryState(nextHistory)
      setValidationErrors([])
      setSavePhase('saved')
      return result
    } catch (switchError) {
      if (switchError.response?.status === 409) {
        setError(switchError.response.data)
        setSavePhase('conflict')
      } else {
        setError(switchError)
        setSavePhase('failed')
      }
      return null
    }
  }, [flushPendingEdits, publicId, persistDraft, setSavePhase])

  const applySample = useCallback(async (sampleContentPublicId) => {
    flushPendingEdits()
    if (phaseRef.current === 'conflict' || !sampleContentPublicId) return null
    const didPersist = await persistDraft()
    if (!didPersist) return null
    const before = documentRef.current
    setSavePhase('saving')
    try {
      const draft = await applyCvSample(
        publicId,
        sampleContentPublicId,
        lockVersionRef.current,
        clientSessionIdRef.current,
      )
      const nextDocument = {
        schema_version: draft.schema_version,
        content_json: draft.content_json,
        layout_json: draft.layout_json,
        style_json: draft.style_json,
      }
      const nextHistory = recordDocumentCommand(historyRef.current, before, nextDocument, 'Áp dụng nội dung mẫu')
      historyRef.current = nextHistory
      setHistoryState(nextHistory)
      documentRef.current = nextDocument
      lockVersionRef.current = draft.lock_version
      lastSavedSignatureRef.current = signature(nextDocument)
      setDocument(nextDocument)
      setAssets(draft.assets || {})
      setSavedAt(new Date())
      setSavePhase('saved')
      return draft
    } catch (sampleError) {
      if (sampleError.response?.status === 409) setSavePhase('conflict')
      else setSavePhase('failed')
      setError(sampleError.response?.data || sampleError)
      return null
    }
  }, [flushPendingEdits, publicId, persistDraft, setSavePhase])

  const rename = useCallback(async (title) => {
    const nextCv = await renameCv(publicId, title)
    setCv(nextCv)
    return nextCv
  }, [publicId])

  const updateProfile = useCallback(async (changes) => {
    const nextCv = await updateCvProfile(publicId, changes)
    setCv(nextCv)
    return nextCv
  }, [publicId])

  const rememberAsset = useCallback((asset) => {
    if (!asset?.public_id) return
    setAssets((current) => ({ ...current, [asset.public_id]: asset }))
  }, [])

  return {
    cv,
    updateProfile,
    assets,
    document,
    phase,
    error,
    lastVersion,
    validationErrors,
    savedAt,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    lockVersion: lockVersionRef.current,
    updateDocument,
    registerPendingEdit,
    flushPendingEdits,
    undo,
    redo,
    retrySave,
    reloadDraft: load,
    saveDraft,
    saveVersion: () => commitVersion(false),
    publishVersion: () => commitVersion(true),
    switchTemplate,
    applySample,
    rename,
    rememberAsset,
  }
}
