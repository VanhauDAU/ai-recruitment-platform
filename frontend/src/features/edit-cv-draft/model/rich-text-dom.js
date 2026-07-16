import { normalizeRuns, richTextV2 } from '@/entities/cv'

function colorToHex(value) {
  if (value?.startsWith('#')) return value.toUpperCase()
  const match = value?.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!match) return undefined
  return `#${match.slice(1).map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

function marksForNode(node, inherited = {}) {
  if (node.nodeType !== Node.ELEMENT_NODE) return inherited
  const element = node
  const marks = { ...inherited }
  const tag = element.tagName.toLowerCase()
  if (tag === 'strong' || tag === 'b' || Number(element.style.fontWeight) >= 600) marks.bold = true
  if (tag === 'em' || tag === 'i' || element.style.fontStyle === 'italic') marks.italic = true
  if (tag === 'u' || element.style.textDecoration.includes('underline')) marks.underline = true
  if (element.style.fontFamily) marks.font_family = element.style.fontFamily.replaceAll('"', '').split(',')[0].trim()
  if (element.style.fontSize.endsWith('pt')) marks.font_size_pt = Number.parseFloat(element.style.fontSize)
  const color = colorToHex(element.style.color)
  if (color) marks.color = color
  return marks
}

function collectRuns(node, inherited = {}, output = []) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (node.textContent) output.push({ text: node.textContent, marks: inherited })
    return output
  }
  const marks = marksForNode(node, inherited)
  for (const child of node.childNodes) collectRuns(child, marks, output)
  return output
}

export function domToRichText(root) {
  if (!root) return richTextV2('')
  const children = [...root.children]
  const blocks = (children.length ? children : [root]).map((element) => {
    const runs = normalizeRuns(collectRuns(element))
    return {
      type: element.tagName?.toLowerCase() === 'li' ? 'bullet' : 'paragraph',
      text: runs.map((run) => run.text).join(''),
      runs,
    }
  }).filter((block) => block.text)
  return { format: 'rich_text_v2', content: blocks }
}

export function selectionOffsets(root) {
  const selection = globalThis.getSelection?.()
  if (!selection?.rangeCount || !root.contains(selection.anchorNode) || !root.contains(selection.focusNode)) return null
  const range = selection.getRangeAt(0)
  const prefix = range.cloneRange()
  prefix.selectNodeContents(root)
  prefix.setEnd(range.startContainer, range.startOffset)
  return { start: prefix.toString().length, end: prefix.toString().length + range.toString().length }
}
