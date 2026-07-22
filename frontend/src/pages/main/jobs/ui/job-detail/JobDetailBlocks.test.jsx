import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WorkplaceGroups } from './JobDetailBlocks'

describe('WorkplaceGroups', () => {
  it('renders at most three locations, grouped by province, and summarizes the remainder', () => {
    render(
      <WorkplaceGroups
        groups={[
          {
            province_id: 1,
            province_name: 'Thành phố Đà Nẵng',
            addresses: [
              { address_detail: '55 Nguyễn Văn Linh', ward_name: 'Phường Hải Châu' },
              { address_detail: '12 Trần Phú', ward_name: 'Phường Hải Châu' },
            ],
          },
          {
            province_id: 2,
            province_name: 'Thành phố Hà Nội',
            addresses: [
              { address_detail: '90 Cầu Giấy', ward_name: 'Phường Cầu Giấy' },
              { address_detail: '1 Duy Tân', ward_name: 'Phường Cầu Giấy' },
            ],
          },
        ]}
      />,
    )

    expect(screen.getAllByText('Thành phố Đà Nẵng:', { exact: false })).toHaveLength(2)
    expect(screen.getByText(/55 Nguyễn Văn Linh, Phường Hải Châu/)).toBeInTheDocument()
    expect(screen.getByText(/12 Trần Phú, Phường Hải Châu/)).toBeInTheDocument()
    expect(screen.getByText(/90 Cầu Giấy, Phường Cầu Giấy/)).toBeInTheDocument()
    expect(screen.queryByText(/1 Duy Tân, Phường Cầu Giấy/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '... và 1 địa điểm khác' }))
    expect(screen.getByText(/1 Duy Tân, Phường Cầu Giấy/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thu gọn' })).toBeInTheDocument()
  })
})
