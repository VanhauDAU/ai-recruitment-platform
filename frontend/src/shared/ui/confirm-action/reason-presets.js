/**
 * Clicking a preset fills an empty reason (or swaps one preset for another);
 * once the admin has written their own text the preset is appended instead
 * of overwriting it.
 */
export function applyReasonPreset(current, preset, presets = []) {
  const text = (current || '').trim()
  if (!text || presets.includes(text)) return preset
  if (text.includes(preset)) return text
  return `${text}; ${preset}`
}
