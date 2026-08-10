#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { deflateSync, inflateSync } from 'node:zlib'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

const CANVAS_SIZE = 500
const DEFAULT_SOURCE = join(homedir(), 'Downloads', 'procv-robot')
const OUTPUT_ROOT = resolve(import.meta.dirname, '../public/images/mascot')
const CWEBP = process.env.CWEBP || '/opt/homebrew/bin/cwebp'
const WEBPINFO = process.env.WEBPINFO || '/opt/homebrew/bin/webpinfo'

const ASSETS = [
  ['base/robot-head.png', 'base/robot-head.webp'],
  ['base/robot-body-core.png', 'base/robot-body-core.webp'],
  ['base/robot-shadow-ground.png', 'base/robot-shadow-ground.webp'],
  ['base/robot-shadow-floating.png', 'base/robot-shadow-floating.webp'],
  ['face/eyes/robot-eyes-neutral.png', 'face/eyes/robot-eyes-neutral.webp'],
  ['face/eyes/robot-eyes-blink.png', 'face/eyes/robot-eyes-blink.webp'],
  ['face/eyes/robot-eyes-happy.png', 'face/eyes/robot-eyes-happy.webp'],
  ['face/eyes/robot-eyes-thinking.png', 'face/eyes/robot-eyes-thinking.webp'],
  ['face/eyes/robot-eyes-success.png', 'face/eyes/robot-eyes-success.webp'],
  ['face/eyes/robot-eyes-error.png', 'face/eyes/robot-eyes-error.webp'],
  ['face/eyes/robot-eyes-look-down.png', 'face/eyes/robot-eyes-look-down.webp'],
  ['face/mouths/robot-mouth-neutral.png', 'face/mouths/robot-mouth-neutral.webp'],
  ['face/mouths/robot-mouth-happy.png', 'face/mouths/robot-mouth-happy.webp'],
  ['face/mouths/robot-mouth-thinking.png', 'face/mouths/robot-mouth-thinking.webp'],
  ['face/mouths/robot-mouth-success.png', 'face/mouths/robot-mouth-success.webp'],
  ['face/mouths/robot-mouth-error.png', 'face/mouths/robot-mouth-error.webp'],
  ['arms/neutral/robot-arm-left-neutral.png.png', 'arms/neutral/robot-arm-left-neutral.webp'],
  ['arms/neutral/robot-arm-right-neutral.png', 'arms/neutral/robot-arm-right-neutral.webp'],
  ['arms/gestures/robot-arm-left-wave.png', 'arms/gestures/robot-arm-left-wave.webp'],
  ['arms/gestures/robot-arm-left-thumbs-up.png', 'arms/gestures/robot-arm-left-thumbs-up.webp'],
  ['arms/hold/robot-arm-left-hold.png', 'arms/hold/robot-arm-left-hold.webp'],
  ['arms/hold/robot-arm-right-hold.png', 'arms/hold/robot-arm-right-hold.webp'],
  ['arms/hold/robot-hand-left-hold-front.png', 'arms/hold/robot-hand-left-hold-front.webp', true],
  ['arms/hold/robot-hand-right-hold-front.png', 'arms/hold/robot-hand-right-hold-front.webp'],
  ['arms/grip/robot-arm-left-grip.png', 'arms/grip/robot-arm-left-grip.webp'],
  ['arms/grip/robot-hand-left-grip-front.png', 'arms/grip/robot-hand-left-grip-front.webp'],
  ['arms/carry/robot-arm-left-carry.png', 'arms/carry/robot-arm-left-carry.webp'],
  ['arms/carry/robot-hand-left-carry-front.png', 'arms/carry/robot-hand-left-carry-front.webp'],
  ['arms/auth/robot-arm-left-cover-eyes-front.png', 'arms/auth/robot-arm-left-cover-eyes-front.webp'],
  ['arms/auth/robot-arm-right-cover-eyes-front.png', 'arms/auth/robot-arm-right-cover-eyes-front.webp'],
  ['arms/auth/robot-hands-frame-grip.png', 'arms/auth/robot-hands-frame-grip.webp'],
  ['props/robot-prop-badge.png', 'props/robot-prop-badge.webp'],
  ['props/robot-prop-briefcase.png', 'props/robot-prop-briefcase.webp'],
  ['props/robot-prop-checklist.png', 'props/robot-prop-checklist.webp'],
  ['props/robot-prop-cv.png', 'props/robot-prop-cv.webp'],
  ['props/robot-prop-magnifier.png', 'props/robot-prop-magnifier.webp'],
  ['props/robot-prop-microphonepng.png', 'props/robot-prop-microphone.webp'],
  ['props/robot-prop-tie.png', 'props/robot-prop-tie.webp'],
  ['scenes/robot-cv-helper.png', 'scenes/robot-cv-helper.webp'],
  ['scenes/robot-empty-state-cv.png', 'scenes/robot-empty-state-cv.webp'],
  ['scenes/robot-empty-state-jobs.png', 'scenes/robot-empty-state-jobs.webp'],
  ['scenes/robot-interview-coach.png', 'scenes/robot-interview-coach.webp'],
  ['scenes/robot-profile-check.png', 'scenes/robot-profile-check.webp'],
  ['scenes/robot-search-job.png', 'scenes/robot-search-job.webp'],
]

function sourceArgument() {
  const index = process.argv.indexOf('--src')
  if (index === -1) return DEFAULT_SOURCE
  if (!process.argv[index + 1]) throw new Error('Thiếu đường dẫn sau --src')
  return resolve(process.argv[index + 1])
}

function pngInfo(buffer) {
  const signature = buffer.subarray(0, 8).toString('hex')
  if (signature !== '89504e470d0a1a0a' || buffer.subarray(12, 16).toString() !== 'IHDR') {
    throw new Error('Không phải PNG hợp lệ')
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer[24],
    colorType: buffer[25],
    interlace: buffer[28],
  }
}

function pngChunks(buffer) {
  const chunks = []
  let offset = 8
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.subarray(offset + 4, offset + 8).toString()
    chunks.push({ type, data: buffer.subarray(offset + 8, offset + 8 + length) })
    offset += length + 12
  }
  return chunks
}

function paeth(left, above, upperLeft) {
  const estimate = left + above - upperLeft
  const leftDistance = Math.abs(estimate - left)
  const aboveDistance = Math.abs(estimate - above)
  const diagonalDistance = Math.abs(estimate - upperLeft)
  if (leftDistance <= aboveDistance && leftDistance <= diagonalDistance) return left
  return aboveDistance <= diagonalDistance ? above : upperLeft
}

function unfilterRgba(raw, width, height) {
  const bytesPerPixel = 4
  const rowBytes = width * bytesPerPixel
  const pixels = Buffer.alloc(rowBytes * height)
  let inputOffset = 0
  for (let row = 0; row < height; row += 1) {
    const filter = raw[inputOffset]
    inputOffset += 1
    const rowOffset = row * rowBytes
    for (let column = 0; column < rowBytes; column += 1) {
      const encoded = raw[inputOffset + column]
      const left = column >= bytesPerPixel ? pixels[rowOffset + column - bytesPerPixel] : 0
      const above = row > 0 ? pixels[rowOffset + column - rowBytes] : 0
      const upperLeft = row > 0 && column >= bytesPerPixel
        ? pixels[rowOffset + column - rowBytes - bytesPerPixel]
        : 0
      let predictor = 0
      if (filter === 1) predictor = left
      else if (filter === 2) predictor = above
      else if (filter === 3) predictor = Math.floor((left + above) / 2)
      else if (filter === 4) predictor = paeth(left, above, upperLeft)
      else if (filter !== 0) throw new Error(`PNG filter không được hỗ trợ: ${filter}`)
      pixels[rowOffset + column] = (encoded + predictor) & 0xff
    }
    inputOffset += rowBytes
  }
  return pixels
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function makeChunk(type, data) {
  const typeBuffer = Buffer.from(type)
  const chunk = Buffer.alloc(data.length + 12)
  chunk.writeUInt32BE(data.length, 0)
  typeBuffer.copy(chunk, 4)
  data.copy(chunk, 8)
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), data.length + 8)
  return chunk
}

function padRgbaPngTopLeft(sourcePath, destinationPath) {
  const buffer = readFileSync(sourcePath)
  const info = pngInfo(buffer)
  if (info.bitDepth !== 8 || info.colorType !== 6 || info.interlace !== 0) {
    throw new Error(`${basename(sourcePath)} phải là PNG RGBA 8-bit, không interlace để pad an toàn`)
  }
  if (info.width > CANVAS_SIZE || info.height > CANVAS_SIZE) {
    throw new Error(`${basename(sourcePath)} lớn hơn canvas ${CANVAS_SIZE}x${CANVAS_SIZE}`)
  }
  const chunks = pngChunks(buffer)
  const compressed = Buffer.concat(chunks.filter(({ type }) => type === 'IDAT').map(({ data }) => data))
  const pixels = unfilterRgba(inflateSync(compressed), info.width, info.height)
  const outputRowBytes = CANVAS_SIZE * 4
  const raw = Buffer.alloc((outputRowBytes + 1) * CANVAS_SIZE)
  for (let row = 0; row < info.height; row += 1) {
    const outputOffset = row * (outputRowBytes + 1)
    raw[outputOffset] = 0
    pixels.copy(raw, outputOffset + 1, row * info.width * 4, (row + 1) * info.width * 4)
  }
  const ihdr = Buffer.from(chunks.find(({ type }) => type === 'IHDR').data)
  ihdr.writeUInt32BE(CANVAS_SIZE, 0)
  ihdr.writeUInt32BE(CANVAS_SIZE, 4)
  writeFileSync(destinationPath, Buffer.concat([
    buffer.subarray(0, 8),
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', deflateSync(raw, { level: 9 })),
    makeChunk('IEND', Buffer.alloc(0)),
  ]))
}

function assertWebpCanvas(path) {
  const details = execFileSync(WEBPINFO, ['-summary', path], { encoding: 'utf8' })
  const match = details.match(/Canvas size\s+(\d+)\s+x\s+(\d+)/)
  if (!match || Number(match[1]) !== CANVAS_SIZE || Number(match[2]) !== CANVAS_SIZE) {
    throw new Error(`Output không đúng canvas ${CANVAS_SIZE}x${CANVAS_SIZE}: ${path}`)
  }
}

function main() {
  const sourceRoot = sourceArgument()
  if (!existsSync(sourceRoot)) throw new Error(`Không tìm thấy thư mục asset: ${sourceRoot}`)
  if (!existsSync(CWEBP)) throw new Error(`Không tìm thấy cwebp tại ${CWEBP}; đặt biến CWEBP nếu cài ở vị trí khác`)
  if (!existsSync(WEBPINFO)) throw new Error(`Không tìm thấy webpinfo tại ${WEBPINFO}; đặt biến WEBPINFO nếu cài ở vị trí khác`)

  const workRoot = mkdtempSync(join(tmpdir(), 'procv-mascot-'))
  try {
    for (const [sourceRelative, outputRelative, needsPadding] of ASSETS) {
      const sourcePath = join(sourceRoot, sourceRelative)
      const outputPath = join(OUTPUT_ROOT, outputRelative)
      if (!existsSync(sourcePath)) throw new Error(`Thiếu asset nguồn: ${sourcePath}`)
      const info = pngInfo(readFileSync(sourcePath))
      let conversionInput = sourcePath
      if (needsPadding && (info.width !== CANVAS_SIZE || info.height !== CANVAS_SIZE)) {
        conversionInput = join(workRoot, basename(sourceRelative).replace(/\.png$/, '-padded.png'))
        padRgbaPngTopLeft(sourcePath, conversionInput)
      } else if (info.width !== CANVAS_SIZE || info.height !== CANVAS_SIZE) {
        throw new Error(`${sourceRelative} có canvas ${info.width}x${info.height}; cần khai báo pad có chủ đích`)
      }
      mkdirSync(dirname(outputPath), { recursive: true })
      execFileSync(CWEBP, ['-quiet', '-q', '82', '-alpha_q', '90', '-m', '6', conversionInput, '-o', outputPath])
      assertWebpCanvas(outputPath)
      process.stdout.write(`✓ ${outputRelative}\n`)
    }
  } finally {
    rmSync(workRoot, { recursive: true, force: true })
  }
  process.stdout.write(`Đã tạo ${ASSETS.length} asset WebP tại ${OUTPUT_ROOT}\n`)
}

main()
