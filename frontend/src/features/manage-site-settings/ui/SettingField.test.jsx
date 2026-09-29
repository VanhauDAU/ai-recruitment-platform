import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SettingField from './SettingField'

describe('SettingField number metadata', () => {
  it('honors integer, min, max and step constraints supplied by the backend', async () => {
    const onChange = vi.fn()
    render(
      <SettingField
        setting={{
          value_type: 'number',
          options: { integer: true, min: 1, max: 60, step: 1 },
        }}
        value={6}
        onChange={onChange}
      />,
    )

    const input = screen.getByRole('spinbutton')
    await userEvent.click(input)
    await userEvent.keyboard('{ArrowUp}')
    expect(onChange).toHaveBeenLastCalledWith(7)
  })
})
