import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Modal } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import {
  candidateJobAlertKeys,
  createCandidateJobAlert,
  getCandidateJobAlerts,
} from '@/entities/candidate-job-alert'
import { getJobCategories, jobKeys } from '@/entities/job'
import { getProvinces } from '@/entities/location'
import { useSession } from '@/entities/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { jobAlertErrorCode } from '../model/job-alert-form'
import JobAlertFormModal from './JobAlertFormModal'

const CATALOG_STALE_TIME = 10 * 60 * 1000

export default function CreateJobAlertModal({ initialValues, onClose, onCreated, open }) {
  const queryClient = useQueryClient()
  const { user } = useSession()
  const [emailRejected, setEmailRejected] = useState(false)
  const alertListKey = candidateJobAlertKeys.list()
  const alertsQuery = useQuery({
    queryKey: alertListKey,
    queryFn: getCandidateJobAlerts,
    enabled: open,
    retry: false,
  })
  const categoriesQuery = useQuery({
    queryKey: jobKeys.categories,
    queryFn: () => getJobCategories(),
    enabled: open,
    staleTime: CATALOG_STALE_TIME,
  })
  const provincesQuery = useQuery({
    queryKey: ['locations', 'provinces'],
    queryFn: getProvinces,
    enabled: open,
    staleTime: CATALOG_STALE_TIME,
  })

  const mutation = useMutation({
    mutationFn: createCandidateJobAlert,
    onSuccess: (created) => {
      queryClient.setQueryData(alertListKey, (current) => ({
        limit: current?.limit ?? 5,
        remaining: Math.max(0, (current?.remaining ?? 1) - 1),
        results: [created, ...(current?.results || [])],
      }))
      message.success('Đã tạo thông báo việc làm.')
      onCreated?.(created)
      closeModal()
    },
    onError: (error) => {
      const code = jobAlertErrorCode(error)
      if (code === 'duplicate_alert') {
        message.error('Bạn đã có một thông báo với cùng tiêu chí.')
        return
      }
      if (code === 'alert_limit_reached') {
        message.error('Bạn đã dùng hết 5 thông báo việc làm.')
        alertsQuery.refetch()
        return
      }
      if (code === 'email_unverified') {
        setEmailRejected(true)
        queryClient.invalidateQueries({ queryKey: alertListKey })
        message.warning('Vui lòng xác thực email trước khi tạo thông báo việc làm.')
        return
      }
      message.error(getApiErrorMessage(error, 'Không thể tạo thông báo việc làm.'))
    },
  })

  function closeModal() {
    setEmailRejected(false)
    onClose()
  }

  if (!open) return null

  if (!user?.email_verified || emailRejected) {
    return (
      <Modal open title="Tạo thông báo việc làm mới" footer={null} onCancel={closeModal}>
        <Alert
          showIcon
          type="warning"
          title="Xác thực email để tạo thông báo"
          description="Thông báo việc làm chỉ được gửi tới email đăng nhập đã xác thực."
          action={<Link to="/tai-khoan/xac-thuc-email" onClick={closeModal} className="font-semibold text-amber-700 hover:underline">Xác thực email</Link>}
        />
      </Modal>
    )
  }

  if (alertsQuery.isError) {
    return (
      <Modal open title="Tạo thông báo việc làm mới" footer={null} onCancel={closeModal}>
        <Alert
          showIcon
          type="error"
          title="Không thể kiểm tra giới hạn thông báo"
          description={getApiErrorMessage(alertsQuery.error, 'Vui lòng thử lại.')}
          action={<Button loading={alertsQuery.isFetching} onClick={() => alertsQuery.refetch()}>Thử lại</Button>}
        />
      </Modal>
    )
  }

  if (!alertsQuery.isPending && (alertsQuery.data?.remaining ?? 0) <= 0) {
    return (
      <Modal open title="Tạo thông báo việc làm mới" footer={null} onCancel={closeModal}>
        <Alert
          showIcon
          type="info"
          title="Bạn đã dùng hết 5 thông báo việc làm"
          description="Hãy chỉnh sửa hoặc xóa một thông báo hiện có trước khi tạo tiêu chí mới."
          action={<Button onClick={closeModal}>Đóng</Button>}
        />
      </Modal>
    )
  }

  if (categoriesQuery.isError || provincesQuery.isError) {
    return (
      <Modal open title="Tạo thông báo việc làm mới" footer={null} onCancel={closeModal}>
        <Alert
          showIcon
          type="error"
          title="Không thể tải danh mục tạo thông báo"
          description="Danh mục ngành nghề hoặc địa điểm chưa tải được. Vui lòng thử lại."
          action={(
            <Button
              loading={categoriesQuery.isFetching || provincesQuery.isFetching}
              onClick={() => Promise.all([categoriesQuery.refetch(), provincesQuery.refetch()])}
            >
              Thử lại
            </Button>
          )}
        />
      </Modal>
    )
  }

  return (
    <JobAlertFormModal
      open
      initialValues={initialValues}
      email={user?.email}
      categories={categoriesQuery.data || []}
      categoriesLoading={categoriesQuery.isPending}
      provinces={provincesQuery.data || []}
      provincesLoading={provincesQuery.isPending}
      saving={mutation.isPending}
      submitDisabled={alertsQuery.isPending}
      onCancel={closeModal}
      onSubmit={(payload) => mutation.mutate(payload)}
    />
  )
}
