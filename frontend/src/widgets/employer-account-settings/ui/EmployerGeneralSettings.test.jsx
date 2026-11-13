import { render, screen } from '@testing-library/react'
import { App } from 'antd'
import { describe, expect, it, vi } from 'vitest'
import EmployerGeneralSettings from './EmployerGeneralSettings'

vi.mock('@/features/configure-employer-notifications', () => ({
  EmployerNotificationPreferences: () => <div data-testid="employer-notification-preferences" />,
}))

describe('EmployerGeneralSettings', () => {
  it('renders the recruiter notification preferences and CV notification card', () => {
    render(
      <App>
        <EmployerGeneralSettings />
      </App>,
    )

    expect(screen.getByText('Thông báo CV ứng tuyển')).toBeInTheDocument()
    expect(screen.getByText('Đang hoạt động')).toBeInTheDocument()
    expect(screen.getByTestId('employer-notification-preferences')).toBeInTheDocument()
  })
})
