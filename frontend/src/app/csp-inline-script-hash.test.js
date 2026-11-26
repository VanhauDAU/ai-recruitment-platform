// @vitest-environment node
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Sửa script inline trong index.html mà quên tính lại hash thì CSP chặn nó (lúc
// Report-Only: mỗi lượt tải trang gửi một báo cáo vi phạm lên Sentry).
const root = resolve(import.meta.dirname, '../..')
const read = (file) => readFileSync(resolve(root, file), 'utf8')

describe('CSP script-src', () => {
  it('allows every inline script of index.html by hash', () => {
    const csp = read('docker/nginx/snippets/csp.conf')
    const inlineScripts = [...read('index.html').matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
      .map((match) => match[1])
      .filter((body) => body.trim())

    expect(inlineScripts.length).toBeGreaterThan(0)
    for (const body of inlineScripts) {
      const hash = createHash('sha256').update(body).digest('base64')
      expect(csp).toContain(`'sha256-${hash}'`)
    }
  })
})
