import { Empty } from 'antd'
import ServiceActivationCard from './ServiceActivationCard'

export default function ServiceActivationList({
  activations,
  emptyDescription = 'Chưa có dịch vụ phù hợp',
  ...cardProps
}) {
  if (!activations?.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription} />
  }
  return (
    <div className="grid gap-3">
      {activations.map((activation) => (
        <ServiceActivationCard
          key={activation.public_id}
          activation={activation}
          {...cardProps}
        />
      ))}
    </div>
  )
}
