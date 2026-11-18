import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import HelpTip from './HelpTip'

describe('HelpTip', () => {
  it('explains on hover and on keyboard focus', async () => {
    const user = userEvent.setup()
    render(<p>Chi phí / hồ sơ<HelpTip label="Giải thích chi phí / hồ sơ">Đã chi ÷ số hồ sơ.</HelpTip></p>)

    const button = screen.getByRole('button', { name: 'Giải thích chi phí / hồ sơ' })
    await user.hover(button)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Đã chi ÷ số hồ sơ.')

    await user.unhover(button)
    await user.tab()
    expect(button).toHaveFocus()
  })
})
