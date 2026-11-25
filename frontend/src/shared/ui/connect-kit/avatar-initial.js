/** Initial for an avatar: first letter of the last word (Vietnamese given name). */
export function avatarInitial(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return (words.at(-1) || '?').charAt(0).toLocaleUpperCase()
}
