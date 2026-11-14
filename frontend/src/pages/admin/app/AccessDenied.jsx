import { Button, Result } from 'antd'
import { Link } from 'react-router'
import { adminPath } from '@/shared/config/portals'

export default function AccessDenied() {
  return (
    <div className="space-y-5">
      <Result
        status="403"
        title="Không có quyền truy cập"
        subTitle="Khu vực này chỉ dành cho superuser."
        extra={(
          <Link to={adminPath('/dashboard')}>
            <Button type="primary">Về bảng điều khiển</Button>
          </Link>
        )}
      />
    </div>
  )
}
