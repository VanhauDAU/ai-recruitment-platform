import { Button, Result } from 'antd'
import { Link } from 'react-router-dom'
import { adminPath } from '@/shared/config/portals'

export default function AccessDenied() {
  return (
    <Result
      status="403"
      title="Không có quyền truy cập"
      subTitle="Tài khoản của bạn chưa được cấp quyền cho khu vực này."
      extra={(
        <Link to={adminPath('/my-access')}>
          <Button type="primary">Xem quyền của tôi</Button>
        </Link>
      )}
    />
  )
}
