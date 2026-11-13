import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CvProfilePanel from './CvProfilePanel'

const mocks = vi.hoisted(() => ({ getCvPositionOptions: vi.fn(), getCvPositionDetails: vi.fn() }))
vi.mock('@/entities/cv-template', () => mocks)

const SECTION = { section_key: 'position_details', title: 'Thông tin chuyên môn', items: [] }

describe('CvProfilePanel', () => {
  beforeEach(() => {
    mocks.getCvPositionOptions.mockResolvedValue([{ public_id: 'jobcat_dev', display_name: 'Lập trình viên' }])
    mocks.getCvPositionDetails.mockResolvedValue(SECTION)
  })

  it('saves the target position, then swaps in its professional details', async () => {
    const onUpdate = vi.fn().mockResolvedValue({})
    const onPositionDetails = vi.fn()
    render(<CvProfilePanel cv={{ position_public_id: null, position_level: '' }} locale="vi-VN" onUpdate={onUpdate} onPositionDetails={onPositionDetails} />)

    fireEvent.mouseDown(await screen.findByLabelText('Vị trí mục tiêu'))
    fireEvent.click(await screen.findByText('Lập trình viên'))

    await waitFor(() => expect(onPositionDetails).toHaveBeenCalledWith(SECTION))
    expect(onUpdate).toHaveBeenCalledWith({ position_public_id: 'jobcat_dev' })
    expect(mocks.getCvPositionDetails).toHaveBeenCalledWith('jobcat_dev', 'vi-VN')
  })

  it('saves the desired level without touching the CV content', async () => {
    const onUpdate = vi.fn().mockResolvedValue({})
    const onPositionDetails = vi.fn()
    render(<CvProfilePanel cv={{ position_public_id: null, position_level: '' }} locale="vi-VN" onUpdate={onUpdate} onPositionDetails={onPositionDetails} />)

    fireEvent.mouseDown(screen.getByLabelText('Cấp bậc mong muốn'))
    fireEvent.click(await screen.findByText('Trưởng nhóm'))

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith({ position_level: 'team_lead' }))
    expect(onPositionDetails).not.toHaveBeenCalled()
  })
})
