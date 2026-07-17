export function buildJobListTitle({ count, contextLabel, loading, updateLabel }) {
  const resultLabel = loading ? 'việc làm' : `${count} việc làm`

  return ['Tuyển dụng', resultLabel, contextLabel, updateLabel].filter(Boolean).join(' ')
}
