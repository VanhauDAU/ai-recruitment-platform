import { DashboardOutlined, PlusOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { Link } from 'react-router'
import { adminPath } from '@/shared/config/portals'
import { AdminCvShell } from '@/widgets/admin-cv-nav'
import { AdminCvOverview } from '@/widgets/admin-cv-overview'

export default function AdminCvOverviewPage() {
  return (
    <AdminCvShell title="Tổng quan Mẫu CV" description="Việc cần làm và số liệu sử dụng mẫu CV." icon={<DashboardOutlined />} actions={<Link to={adminPath('/cv/templates?new=1')}><Button type="primary" icon={<PlusOutlined />}>Tạo mẫu CV</Button></Link>}>
      <AdminCvOverview />
    </AdminCvShell>
  )
}
