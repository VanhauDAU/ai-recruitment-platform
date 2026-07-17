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
  const blockElements = children.flatMap((element) => ['ul', 'ol'].includes(element.tagName?.toLowerCase())
    ? [...element.children]
    : [element])
  const blocks = (blockElements.length ? blockElements : [root]).map((element) => {
    const runs = normalizeRuns(collectRuns(element))
    return {
      type: element.dataset?.richBlock === 'bullet' || element.tagName?.toLowerCase() === 'li' ? 'bullet' : 'paragraph',
      text: runs.map((run) => run.text).join(''),
      runs,
    }
  }).filter((block) => block.text)
  return { format: 'rich_text_v2', content: blocks }
}

export function renderRichText(root, value) {
  if (!root) return
  const document = root.ownerDocument
  const fragment = document.createDocumentFragment()
  for (const block of value?.content || []) {
    const element = document.createElement('div')
    element.dataset.richBlock = block.type === 'bullet' ? 'bullet' : 'paragraph'
    if (block.type === 'bullet') element.className = 'cv-rich-text__bullet'
    for (const run of block.runs || []) {
      const span = document.createElement('span')
      const marks = run.marks || {}
      if (marks.bold) span.style.fontWeight = '700'
      if (marks.italic) span.style.fontStyle = 'italic'
      if (marks.underline) span.style.textDecoration = 'underline'
      if (marks.font_family) span.style.fontFamily = marks.font_family
      if (marks.font_size_pt) span.style.fontSize = `${marks.font_size_pt}pt`
      if (marks.color) span.style.color = marks.color
      span.textContent = run.text
      element.append(span)
    }
    fragment.append(element)
  }
  root.replaceChildren(fragment)
}

function textNodes(element) {
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)
  return nodes
}

function locateTextOffset(root, offset) {
  const blocks = [...root.children]
  let remaining = Math.max(0, offset)
  for (let index = 0; index < blocks.length; index += 1) {
    const nodes = textNodes(blocks[index])
    const length = nodes.reduce((sum, node) => sum + node.textContent.length, 0)
    if (remaining <= length || index === blocks.length - 1) {
      for (const node of nodes) {
        if (remaining <= node.textContent.length) return { node, offset: remaining }
        remaining -= node.textContent.length
      }
      return { node: blocks[index], offset: blocks[index].childNodes.length }
    }
    remaining -= length + 1
  }
  return { node: root, offset: root.childNodes.length }
}

export function restoreSelectionOffsets(root, offsets) {
  if (!root || !offsets) return
  const start = locateTextOffset(root, offsets.start)
  const end = locateTextOffset(root, offsets.end)
  const range = root.ownerDocument.createRange()
  range.setStart(start.node, start.offset)
  range.setEnd(end.node, end.offset)
  const selection = globalThis.getSelection?.()
  selection?.removeAllRanges()
  selection?.addRange(range)
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
