const DEFAULT_HISTORY_LIMIT = 100

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export function createDocumentHistory() {
  return { past: [], future: [] }
}

export function recordDocumentCommand(history, before, after, label, limit = DEFAULT_HISTORY_LIMIT) {
  if (JSON.stringify(before) === JSON.stringify(after)) return history
  const command = { label, before: clone(before), after: clone(after) }
  return { past: [...history.past, command].slice(-limit), future: [] }
}

export function undoDocumentCommand(history) {
  const command = history.past.at(-1)
  if (!command) return { history, document: null }
  return {
    document: clone(command.before),
    history: { past: history.past.slice(0, -1), future: [command, ...history.future] },
  }
}

export function redoDocumentCommand(history) {
  const command = history.future[0]
  if (!command) return { history, document: null }
  return {
    document: clone(command.after),
    history: { past: [...history.past, command], future: history.future.slice(1) },
  }
}
