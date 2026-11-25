export const sameId = (left, right) => String(left) === String(right)
export const focusAfterOpen = (ref) => requestAnimationFrame(() => ref.current?.focus())
