export function shouldSubmitRegistrationOnEnter(event) {
  const target = event.target
  return event.key === 'Enter'
    && target instanceof HTMLInputElement
    && !['checkbox', 'radio', 'button', 'submit'].includes(target.type)
    && target.getAttribute('role') !== 'combobox'
}
