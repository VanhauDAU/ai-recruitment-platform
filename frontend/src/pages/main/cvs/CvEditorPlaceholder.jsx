import { EditOutlined } from '@ant-design/icons'
import { Button, Result } from 'antd'
import { Link, useParams } from 'react-router-dom'

export default function CvEditorPlaceholder() {
  const { publicId } = useParams()
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <Result
        icon={<EditOutlined className="!text-[var(--brand-primary)]" />}
        title="CV của bạn đã sẵn sàng"
        subTitle={`Bản nháp ${publicId} đã được tạo từ template đã phát hành. Trình chỉnh sửa đầy đủ sẽ được triển khai ở bước tiếp theo.`}
        extra={<Link to="/mau-cv"><Button type="primary">Xem thêm mẫu CV</Button></Link>}
      />
    </div>
  )
}
