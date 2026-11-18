import { describe, expect, it } from 'vitest'
import {
  buildJobComparisonPath,
  comparisonSearchParams,
  parseComparisonSlugs,
} from './comparison-url'

describe('job comparison URL', () => {
  it('parses repeated parameters in order, removes invalid/duplicate values and caps at three', () => {
    const params = new URLSearchParams('job=frontend-engineer&job=bad%20slug&job=frontend-engineer&job=backend-engineer&job=designer&job=data')

    expect(parseComparisonSlugs(params)).toEqual([
      'frontend-engineer',
      'backend-engineer',
      'designer',
    ])
  })

  it('builds a shareable path with repeated job parameters', () => {
    expect(buildJobComparisonPath(['frontend-engineer-job_ab12', 'Backend-Engineer-job_CD34']))
      .toBe('/so-sanh-viec-lam?job=frontend-engineer-job_ab12&job=Backend-Engineer-job_CD34')
    expect(comparisonSearchParams([]).toString()).toBe('')
  })

  it('keeps Django-compatible underscore slugs and rejects unsafe paths', () => {
    expect(parseComparisonSlugs('?job=frontend-engineer-job_ab12&job=../admin'))
      .toEqual(['frontend-engineer-job_ab12'])
  })
})
