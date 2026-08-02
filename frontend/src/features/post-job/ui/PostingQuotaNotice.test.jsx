import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import PostingQuotaNotice from './PostingQuotaNotice'

describe('PostingQuotaNotice', () => {
  it('shows the compact level-three quota state and can be dismissed', async () => {
    const user = userEvent.setup()
    render(
      <PostingQuotaNotice
        postingContext={{
          job_postable: true,
          verified_job_quota_eligible: true,
          publish_remain: 97,
          publish_limit: 100,
        }}
      />,
    )

    const notice = screen.getByRole('region', { name: 'Hạn mức đăng tin' })
    expect(notice).toHaveAttribute('data-quota-state', 'eligible')
    expect(within(notice).getByRole('status')).toHaveTextContent('Hạn mức đăng tinĐã mở')
    expect(within(notice).getByRole('status')).toHaveTextContent(
      'Còn 97/100 lượt đăng tin · Tài khoản xác thực Cấp 3.',
    )

    await user.click(within(notice).getByRole('button', { name: 'Đóng thông báo quota đăng tin' }))
    expect(screen.queryByRole('region', { name: 'Hạn mức đăng tin' })).not.toBeInTheDocument()
  })

  it('shows the remaining free quota and the level-three upgrade guidance', () => {
    render(
      <PostingQuotaNotice
        postingContext={{
          job_postable: true,
          verified_job_quota_eligible: false,
          publish_remain: 2,
          publish_limit: 3,
        }}
      />,
    )

    const notice = screen.getByRole('region', { name: 'Hạn mức đăng tin' })
    expect(notice).toHaveAttribute('data-quota-state', 'free')
    expect(within(notice).getByRole('status')).toHaveTextContent('Hạn mức miễn phíĐang sử dụng')
    expect(within(notice).getByRole('status')).toHaveTextContent(
      'Còn 2/3 lượt miễn phí. Hoàn tất xác thực Cấp 3 để mở hạn mức mở rộng.',
    )
  })

  it('keeps a blocked quota visible as a non-dismissible alert', () => {
    render(
      <PostingQuotaNotice
        postingContext={{
          job_postable: false,
          verified_job_quota_eligible: false,
          block_reason: 'Bạn đã dùng hết quota đăng tin',
          publish_remain: 0,
          publish_limit: 3,
        }}
      />,
    )

    const notice = screen.getByRole('region', { name: 'Hạn mức đăng tin' })
    expect(notice).toHaveAttribute('data-quota-state', 'blocked')
    expect(within(notice).getByRole('alert')).toHaveTextContent('Bạn đã dùng hết quota đăng tin')
    expect(within(notice).getByRole('alert')).toHaveTextContent(
      'Bạn vẫn có thể lưu bản nháp. Hoàn tất xác thực Cấp 3 để mở hạn mức đăng tin.',
    )
    expect(within(notice).queryByRole('button', { name: 'Đóng thông báo quota đăng tin' })).not.toBeInTheDocument()
  })
})
