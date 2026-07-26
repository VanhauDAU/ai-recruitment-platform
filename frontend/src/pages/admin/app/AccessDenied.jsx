import { SafetyCertificateOutlined } from '@ant-design/icons'
import { Button, Result } from 'antd'
import { Link } from 'react-router-dom'
import { adminPath } from '@/shared/config/portals'
import { AdminPageHeader, AdminPanel } from '@/widgets/admin-workspace'

export default function AccessDenied() {
  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Kiểm soát truy cập"
        title="Quyền truy cập bị giới hạn"
        description="Hệ thống đã bảo vệ khu vực này theo quyền của tài khoản."
        icon={<SafetyCertificateOutlined />}
      />
      <AdminPanel>
        <Result
          status="403"
          title="Không có quyền truy cập"
          subTitle="Tài khoản của bạn chưa được cấp quyền cho khu vực này."
          extra={(
            <Link to={`${adminPath('/account')}?tab=access`}>
              <Button type="primary">Xem quyền của tôi</Button>
            </Link>
          )}
        />
      </AdminPanel>
    </div>
  )
}
