// Tỉ lệ tương phản WCAG 2.x giữa hai màu #RRGGBB (AA cho chữ thường cần ≥ 4.5).
function luminance(hex) {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
  const [r, g, b] = channels.map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(first, second) {
  const [light, dark] = [luminance(first), luminance(second)].sort((left, right) => right - left)
  return (light + 0.05) / (dark + 0.05)
}
