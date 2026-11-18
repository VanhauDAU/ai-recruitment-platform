import { describe, expect, it } from 'vitest'
import { jobSelection, setupStepStates } from './setup-steps'

const overview = {
  draft_jobs: [
    { public_id: 'a', action: 'publish', number_of_vacancies: 3 },
    { public_id: 'b', action: '', number_of_vacancies: 5 },
  ],
  attachable_jobs: [{ public_id: 'c', action: 'attach', number_of_vacancies: 1 }],
  campaign_jobs: [],
  check: { items: [{ code: 'jobs', ok: true }, { code: 'quota', ok: false }] },
}

describe('setup step states', () => {
  it('derives each step from data instead of its position', () => {
    const states = setupStepStates(
      { target_date: '2026-12-31', budget_max: 15000000 },
      overview,
    )

    expect(jobSelection(overview)).toEqual({ toPublish: 1, toAttach: 1, already: 0, total: 2, headcount: 4 })
    expect(states.goal).toEqual({ done: true, summary: 'Đến 31/12, ngân sách tối đa 15.000.000 đ' })
    expect(states.jobs).toEqual({ done: true, summary: '1 tin sẽ đăng, 1 tin sẽ gắn, tuyển 4 người' })
    expect(states.launch).toMatchObject({ ready: false, summary: 'Còn 1 điều kiện chưa đạt' })
    expect(states.channels).toEqual({ done: false, summary: 'Không bắt buộc, thêm sau cũng được' })
    expect(setupStepStates({}, overview, 2).channels).toEqual({ done: true, summary: '2 kênh có link theo dõi' })
  })

  it('flags an empty goal and an empty job selection', () => {
    const states = setupStepStates(
      { is_continuous: false },
      { draft_jobs: [], attachable_jobs: [], campaign_jobs: [], check: { items: [] } },
    )

    expect(states.goal.done).toBe(false)
    expect(states.jobs).toEqual({ done: false, summary: 'Chưa chọn tin nào' })
    expect(states.launch.ready).toBe(true)
  })
})
