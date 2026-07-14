import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ensureBasicEditorDocument,
  getCv,
  getCvDraft,
  saveCvVersion,
  updateCvDraft,
} from '@/entities/cv'

const AUTOSAVE_DELAY = 700

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
  const documentRef = useRef(null)
  const lockVersionRef = useRef(null)
  const lastSavedSignatureRef = useRef(null)
  const inFlightRef = useRef(null)
  const phaseRef = useRef('loading')
  const clientSessionIdRef = useRef(sessionId())

  const setSavePhase = useCallback((nextPhase) => {
    phaseRef.current = nextPhase
    setPhaseState(nextPhase)
  }, [])

  const load = useCallback(async () => {
    setSavePhase('loading')
    setError(null)
    setLastVersion(null)
    try {
      const [nextCv, draft] = await Promise.all([getCv(publicId), getCvDraft(publicId)])
      const rawDocument = {
        schema_version: draft.schema_version,
        content_json: draft.content_json,
        layout_json: draft.layout_json,
        style_json: draft.style_json,
      }
      const normalized = ensureBasicEditorDocument(rawDocument)
      const needsInitialAutosave = signature(normalized) !== signature(rawDocument)
      documentRef.current = normalized
      lockVersionRef.current = draft.lock_version
      lastSavedSignatureRef.current = needsInitialAutosave ? signature(rawDocument) : signature(normalized)
      setDocument(normalized)
      setCv(nextCv)
      setSavePhase(needsInitialAutosave ? 'unsaved' : 'saved')
    } catch (loadError) {
      setError(loadError)
      setSavePhase('failed')
    }
  }, [publicId, setSavePhase])

  useEffect(() => { load() }, [load])

  const runAutosave = useCallback(() => {
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
      setSavePhase(signature(documentRef.current) === snapshotSignature ? 'saved' : 'unsaved')
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

  useEffect(() => {
    if (!document || phase !== 'unsaved') return undefined
    const timer = setTimeout(() => { runAutosave() }, AUTOSAVE_DELAY)
    return () => clearTimeout(timer)
  }, [document, phase, runAutosave])

  const updateDocument = useCallback((updater) => {
    if (phaseRef.current === 'conflict') return
    setDocument((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater
      documentRef.current = next
      return next
    })
    setSavePhase('unsaved')
  }, [setSavePhase])

  const retryAutosave = useCallback(() => {
    if (phaseRef.current === 'conflict') return Promise.resolve(false)
    setSavePhase('unsaved')
    return runAutosave()
  }, [runAutosave, setSavePhase])

  const saveVersion = useCallback(async () => {
    if (phaseRef.current === 'conflict') return null
    const didAutosave = await runAutosave()
    if (!didAutosave) return null
    setError(null)
    try {
      const version = await saveCvVersion(publicId, lockVersionRef.current)
      setLastVersion(version)
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
  }, [publicId, runAutosave, setSavePhase])

  return {
    cv,
    document,
    phase,
    error,
    lastVersion,
    lockVersion: lockVersionRef.current,
    updateDocument,
    retryAutosave,
    reloadDraft: load,
    saveVersion,
  }
}
