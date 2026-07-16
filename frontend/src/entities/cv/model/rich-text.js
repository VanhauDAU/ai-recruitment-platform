const EMPTY_MARKS = Object.freeze({})

function sameMarks(left = EMPTY_MARKS, right = EMPTY_MARKS) {
  const leftKeys = Object.keys(left).filter((key) => left[key] !== false && left[key] != null).sort()
  const rightKeys = Object.keys(right).filter((key) => right[key] !== false && right[key] != null).sort()
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key])
}

export function normalizeRuns(runs = []) {
  const normalized = []
  for (const candidate of runs) {
    if (!candidate || typeof candidate.text !== 'string' || !candidate.text) continue
    const marks = Object.fromEntries(Object.entries(candidate.marks || {}).filter(([, value]) => value !== false && value != null))
    const previous = normalized.at(-1)
    if (previous && sameMarks(previous.marks, marks)) previous.text += candidate.text
    else normalized.push({ text: candidate.text, ...(Object.keys(marks).length ? { marks } : {}) })
  }
  return normalized
}

export function richTextV2(text = '') {
  return {
    format: 'rich_text_v2',
    content: text ? [{ type: 'paragraph', text, runs: [{ text }] }] : [],
  }
}

export function toRichTextV2(value) {
  if (value?.format === 'rich_text_v2') return value
  const content = Array.isArray(value?.content) ? value.content : []
  return {
    format: 'rich_text_v2',
    content: content.map((block) => ({
      type: block.type === 'bullet' ? 'bullet' : 'paragraph',
      text: block.text || '',
      runs: block.text ? [{ text: block.text }] : [],
    })),
  }
}

export function blocksToPlainText(value) {
  return Array.isArray(value?.content) ? value.content.map((block) => block.text || '').join('\n') : ''
}

export function setMarkInRange(value, start, end, mark, markValue = true) {
  const document = structuredClone(toRichTextV2(value))
  if (start >= end) return document
  let offset = 0
  document.content = document.content.map((block, blockIndex) => {
    const separator = blockIndex === document.content.length - 1 ? 0 : 1
    const blockStart = offset
    const blockEnd = blockStart + block.text.length
    offset = blockEnd + separator
    if (end <= blockStart || start >= blockEnd) return block
    let runOffset = blockStart
    const runs = []
    for (const run of block.runs) {
      const runStart = runOffset
      const runEnd = runStart + run.text.length
      runOffset = runEnd
      const selectionStart = Math.max(start, runStart) - runStart
      const selectionEnd = Math.min(end, runEnd) - runStart
      if (selectionStart > 0) runs.push({ text: run.text.slice(0, selectionStart), marks: run.marks })
      if (selectionEnd > selectionStart) {
        const marks = { ...(run.marks || {}) }
        if (markValue === false || markValue == null) delete marks[mark]
        else marks[mark] = markValue
        runs.push({ text: run.text.slice(selectionStart, selectionEnd), marks })
      }
      if (selectionEnd < run.text.length) runs.push({ text: run.text.slice(selectionEnd), marks: run.marks })
    }
    const normalized = normalizeRuns(runs)
    return { ...block, text: normalized.map((run) => run.text).join(''), runs: normalized }
  })
  return document
}

export function toggleBooleanMarkInRange(value, start, end, mark) {
  const document = toRichTextV2(value)
  let offset = 0
  let hasSelectedText = false
  let everySelectedRunHasMark = true
  for (let blockIndex = 0; blockIndex < document.content.length; blockIndex += 1) {
    const block = document.content[blockIndex]
    for (const run of block.runs) {
      const runStart = offset
      const runEnd = runStart + run.text.length
      if (end > runStart && start < runEnd) {
        hasSelectedText = true
        if (run.marks?.[mark] !== true) everySelectedRunHasMark = false
      }
      offset = runEnd
    }
    if (blockIndex < document.content.length - 1) offset += 1
  }
  return setMarkInRange(document, start, end, mark, !(hasSelectedText && everySelectedRunHasMark))
}

export function toggleBulletBlocks(value, startBlock, endBlock = startBlock) {
  const document = structuredClone(toRichTextV2(value))
  const selected = document.content.slice(startBlock, endBlock + 1)
  const nextType = selected.every((block) => block.type === 'bullet') ? 'paragraph' : 'bullet'
  document.content = document.content.map((block, index) => (
    index >= startBlock && index <= endBlock ? { ...block, type: nextType } : block
  ))
  return document
}
