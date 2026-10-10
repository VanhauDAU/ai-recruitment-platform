import { describe, expect, it } from 'vitest'
import { escapeCsvCell, serializeCsv } from './admin-csv'

describe('admin CSV helpers', () => {
  it('escapes quotes and keeps every cell structurally safe', () => {
    expect(escapeCsvCell('Nguyễn "An"\nAdmin')).toBe('"Nguyễn ""An""\nAdmin"')
    expect(escapeCsvCell(null)).toBe('""')
    expect(escapeCsvCell(true)).toBe('"Có"')
  })

  it('neutralizes spreadsheet formulas from untrusted admin data', () => {
    expect(escapeCsvCell('=HYPERLINK("https://invalid")')).toBe(
      '"\'=HYPERLINK(""https://invalid"")"',
    )
    expect(escapeCsvCell('-1+2')).toBe('"\'-1+2"')
    expect(escapeCsvCell(-12)).toBe('"-12"')
  })

  it('serializes selected columns with a UTF-8 BOM and CRLF rows', () => {
    const csv = serializeCsv(
      [{ email: 'a@example.com', tags: ['mới', 'ưu tiên'] }],
      [
        { key: 'email', label: 'Email' },
        { label: 'Nhãn', value: (row) => row.tags },
      ],
    )

    expect(csv).toBe('\uFEFF"Email","Nhãn"\r\n"a@example.com","mới | ưu tiên"')
  })
})
