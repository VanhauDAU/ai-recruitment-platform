import { useParams } from 'react-router'
import { useAdminAccess } from '@/entities/admin-access'
import { useSession } from '@/entities/session'
import { AdminJobDetail } from '@/widgets/admin-job-management'
import { ServiceActivationsPanel } from '@/widgets/admin-service-catalog'

export default function JobModerationDetail() {
  const { publicId } = useParams()
  const { user } = useSession()
  const access = useAdminAccess(user)
  const canViewServices = access.has('service_entitlement.view')
  return (
    <div className="mx-auto max-w-[1600px]">
      <AdminJobDetail
        publicId={publicId}
        serviceContent={canViewServices ? (
          <ServiceActivationsPanel
            canManage={access.has('service_entitlement.manage')}
            jobPublicId={publicId}
          />
        ) : null}
      />
    </div>
  )
}
