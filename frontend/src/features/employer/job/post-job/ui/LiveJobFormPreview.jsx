import { Form } from 'antd'
import { useDeferredValue, useMemo } from 'react'
import JobFormPreview from './JobFormPreview'

const EMPTY_VALUES = {}

// Bản xem trước tự theo dõi toàn bộ giá trị và vẽ ở mức ưu tiên thấp, để ô đang gõ
// không phải chờ nó.
export default function LiveJobFormPreview({ form, categories, campaigns, benefits, ...props }) {
  const watched = Form.useWatch([], form)
  const values = useDeferredValue(watched || EMPTY_VALUES)
  const names = useMemo(() => ({
    categoryName: categories.find((item) => item.id === values.category_assignments?.[0]?.category)?.name,
    domainNames: categories.filter((item) => values.domain_category_ids?.includes(item.id)).map((item) => item.name),
    campaignName: campaigns.find((item) => item.public_id === values.campaign)?.name,
    benefitNames: benefits.filter((item) => values.benefit_ids?.includes(item.id)).map((item) => item.name),
  }), [benefits, campaigns, categories, values])
  return <JobFormPreview values={values} {...names} {...props} />
}
