import { ReloadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  candidateJobAlertKeys,
  deleteCandidateJobAlert,
  getCandidateJobAlerts,
  updateCandidateJobAlert,
} from '@/entities/candidate-job-alert'
import {
  candidateNotificationPreferenceKeys,
  candidateNotificationPreferenceMutationKey,
  candidateNotificationPreferenceMutationScope,
  getCandidateNotificationPreferences,
  updateCandidateNotificationPreferences,
} from '@/entities/candidate-notification-preferences'
import { getJobCategories, jobKeys } from '@/entities/job'
import { getProvinces } from '@/entities/location'
import { useSession } from '@/entities/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import {
  JOB_PREFERENCE_SETTINGS_PATH,
  jobAlertErrorCode,
  jobAlertFormValues,
} from '../model/job-alert-form'
import JobAlertCard from './JobAlertCard'
import CreateJobAlertModal from './CreateJobAlertModal'
import JobAlertEmptyState from './JobAlertEmptyState'
import JobAlertFormModal from './JobAlertFormModal'
import JobAlertListSkeleton from './JobAlertListSkeleton'
import JobAlertPageHeader from './JobAlertPageHeader'
import JobAlertPreferencePanel from './JobAlertPreferencePanel'

const CATALOG_STALE_TIME = 10 * 60 * 1000

export default function ManageJobAlerts({ initialCreateValues, openCreateOnMount = false }) {
  const queryClient = useQueryClient()
  const { user } = useSession()
  const [editor, setEditor] = useState(null)
  const [emailUnverified, setEmailUnverified] = useState(!user?.email_verified)
  const [preferenceIssue, setPreferenceIssue] = useState('')
  const openedFromRoute = useRef(false)

  const alertListKey = candidateJobAlertKeys.list()
  const preferenceKey = candidateNotificationPreferenceKeys.preferences()
  const alertsQuery = useQuery({ queryKey: alertListKey, queryFn: getCandidateJobAlerts, retry: false })
  const preferencesQuery = useQuery({
    queryKey: preferenceKey,
    queryFn: getCandidateNotificationPreferences,
    retry: false,
  })
  const categoriesQuery = useQuery({
    queryKey: jobKeys.categories,
    queryFn: () => getJobCategories(),
    enabled: editor?.mode === 'edit',
    staleTime: CATALOG_STALE_TIME,
  })
  const provincesQuery = useQuery({
    queryKey: ['locations', 'provinces'],
    queryFn: getProvinces,
    enabled: editor?.mode === 'edit',
    staleTime: CATALOG_STALE_TIME,
  })

  useEffect(() => {
    if (!openCreateOnMount || openedFromRoute.current || alertsQuery.isPending) return
    openedFromRoute.current = true
    if (emailUnverified || alertsQuery.isError || (alertsQuery.data?.remaining ?? 0) <= 0) return
    setEditor({ mode: 'create', initialValues: jobAlertFormValues(initialCreateValues) })
  }, [alertsQuery.data?.remaining, alertsQuery.isError, alertsQuery.isPending, emailUnverified, initialCreateValues, openCreateOnMount])

  useEffect(() => {
    if (user?.email_verified) setEmailUnverified(false)
  }, [user?.email_verified])

  const preferenceMutation = useMutation({
    mutationKey: candidateNotificationPreferenceMutationKey,
    scope: candidateNotificationPreferenceMutationScope,
    mutationFn: ({ field, checked }) => updateCandidateNotificationPreferences({ [field]: checked }),
    onMutate: async ({ field, checked }) => {
      setPreferenceIssue('')
      await queryClient.cancelQueries({ queryKey: preferenceKey })
      const previousValue = queryClient.getQueryData(preferenceKey)?.[field]
      queryClient.setQueryData(preferenceKey, (current) => ({ ...current, [field]: checked }))
      return { field, optimisticValue: checked, previousValue }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(preferenceKey, (current) => ({ ...current, ...data }))
      message.success('Đã cập nhật cài đặt nhận thông báo.')
    },
    onError: (error, _variables, context) => {
      queryClient.setQueryData(preferenceKey, (current) => {
        if (!context || current?.[context.field] !== context.optimisticValue) return current
        return { ...current, [context.field]: context.previousValue }
      })
      const code = jobAlertErrorCode(error)
      if (code === 'email_unverified') {
        setEmailUnverified(true)
        message.warning('Vui lòng xác thực email trước khi bật thông báo.')
        return
      }
      if (['consent_required', 'preferences_required'].includes(code)) {
        setPreferenceIssue(code)
        return
      }
      message.error(getApiErrorMessage(error, 'Không thể cập nhật cài đặt nhận thông báo.'))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: preferenceKey }),
  })

  const editMutation = useMutation({
    mutationFn: ({ publicId, payload }) => updateCandidateJobAlert(publicId, payload),
    onSuccess: (saved) => {
      queryClient.setQueryData(alertListKey, (current) => ({
        ...current,
        results: (current?.results || []).map((item) => item.public_id === saved.public_id ? saved : item),
      }))
      setEditor(null)
      message.success('Đã cập nhật thông báo việc làm.')
    },
    onError: (error) => {
      const code = jobAlertErrorCode(error)
      if (code === 'duplicate_alert') {
        message.error('Bạn đã có một thông báo với cùng tiêu chí.')
        return
      }
      if (code === 'email_unverified') {
        setEmailUnverified(true)
        setEditor(null)
        return
      }
      message.error(getApiErrorMessage(error, 'Không thể lưu thông báo việc làm.'))
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ alert, checked }) => updateCandidateJobAlert(alert.public_id, { is_active: checked }),
    onMutate: async ({ alert, checked }) => {
      await queryClient.cancelQueries({ queryKey: alertListKey })
      const previous = queryClient.getQueryData(alertListKey)
      queryClient.setQueryData(alertListKey, (current) => ({
        ...current,
        results: (current?.results || []).map((item) => item.public_id === alert.public_id ? { ...item, is_active: checked } : item),
      }))
      return { previous }
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(alertListKey, (current) => ({
        ...current,
        results: (current?.results || []).map((item) => item.public_id === saved.public_id ? saved : item),
      }))
    },
    onError: (error, _variables, context) => {
      queryClient.setQueryData(alertListKey, context?.previous)
      if (jobAlertErrorCode(error) === 'email_unverified') {
        setEmailUnverified(true)
        message.warning('Vui lòng xác thực email trước khi bật thông báo này.')
        return
      }
      message.error(getApiErrorMessage(error, 'Không thể cập nhật trạng thái thông báo.'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCandidateJobAlert,
    onSuccess: (publicId) => {
      queryClient.setQueryData(alertListKey, (current) => ({
        limit: current?.limit ?? 5,
        remaining: Math.min(current?.limit ?? 5, (current?.remaining ?? 0) + 1),
        results: (current?.results || []).filter((item) => item.public_id !== publicId),
      }))
      message.success('Đã xóa thông báo việc làm.')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể xóa thông báo việc làm.')),
  })

  const listData = alertsQuery.data || { results: [], limit: 5, remaining: 5 }
  const alerts = listData.results || []
  const preferences = preferencesQuery.data || {}
  const masterEnabled = preferences.configured_job_alerts !== false
  const suitableEnabled = preferences.suitable_job_recommendations === true
  const createBlocked = emailUnverified || listData.remaining <= 0
  const preferenceSavingField = preferenceMutation.isPending ? preferenceMutation.variables?.field : ''
  const listMutationPending = (
    editMutation.isPending || toggleMutation.isPending || deleteMutation.isPending
  )

  function openCreate() {
    if (createBlocked) return
    setEditor({ mode: 'create', initialValues: jobAlertFormValues(initialCreateValues) })
  }

  function handleSubmit(payload) {
    editMutation.mutate({ publicId: editor.alert.public_id, payload })
  }

  return (
    <section className="space-y-4">
      <JobAlertPageHeader
        createDisabled={createBlocked || alertsQuery.isPending || listMutationPending}
        limit={listData.limit}
        onCreate={openCreate}
        usedCount={alertsQuery.isSuccess ? alerts.length : null}
      />

      {emailUnverified && (
        <Alert
          showIcon
          type="warning"
          title="Xác thực email để nhận thông báo việc làm"
          description="Chúng tôi chỉ gửi thông báo tới email đăng nhập đã được xác thực."
          action={<Link to="/tai-khoan/xac-thuc-email" className="font-semibold text-amber-700 hover:underline">Xác thực email</Link>}
        />
      )}

      {preferenceIssue && (
        <Alert
          showIcon
          type="info"
          title="Hoàn thiện cài đặt gợi ý việc làm"
          description="Hệ thống cần nhu cầu công việc và sự đồng ý của bạn trước khi gửi việc làm phù hợp tự động."
          action={<Link to={JOB_PREFERENCE_SETTINGS_PATH} className="font-semibold text-sky-700 hover:underline">Đi tới cài đặt</Link>}
        />
      )}

      <JobAlertPreferencePanel
        loading={preferencesQuery.isPending}
        error={preferencesQuery.isError}
        masterEnabled={masterEnabled}
        suitableEnabled={suitableEnabled}
        savingField={preferenceSavingField}
        disabled={preferenceMutation.isPending}
        onRetry={() => preferencesQuery.refetch()}
        onChange={(field, checked) => {
          if (checked && emailUnverified) {
            message.warning('Vui lòng xác thực email trước khi bật thông báo.')
            return
          }
          preferenceMutation.mutate({ field, checked })
        }}
      />

      {!masterEnabled && !preferencesQuery.isPending && (
        <Alert
          showIcon
          type="warning"
          title="Toàn bộ thông báo theo thiết lập đang tạm dừng"
          description="Các tiêu chí vẫn được giữ nguyên. Bật lại công tắc chung để tiếp tục nhận email."
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-base font-bold text-slate-900">Danh sách thông báo</h2>
        </div>
        {listData.remaining <= 0 && <span className="text-xs font-semibold text-amber-700">Bạn đã dùng hết giới hạn.</span>}
      </div>

      {alertsQuery.isPending ? (
        <JobAlertListSkeleton />
      ) : alertsQuery.isError ? (
        <Alert
          showIcon
          type="error"
          title="Không thể tải danh sách thông báo việc làm"
          description={getApiErrorMessage(alertsQuery.error, 'Vui lòng thử lại.')}
          action={<Button icon={<ReloadOutlined />} loading={alertsQuery.isFetching} onClick={() => alertsQuery.refetch()}>Thử lại</Button>}
        />
      ) : alerts.length ? (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <JobAlertCard
              key={alert.public_id}
              alert={alert}
              globalEnabled={masterEnabled}
              interactionsDisabled={listMutationPending}
              deleting={deleteMutation.isPending && deleteMutation.variables === alert.public_id}
              toggling={toggleMutation.isPending && toggleMutation.variables?.alert.public_id === alert.public_id}
              onDelete={(item) => deleteMutation.mutateAsync(item.public_id)}
              onEdit={(item) => setEditor({ mode: 'edit', alert: item })}
              onToggle={(item, checked) => {
                if (checked && emailUnverified) {
                  message.warning('Vui lòng xác thực email trước khi bật thông báo này.')
                  return
                }
                toggleMutation.mutate({ alert: item, checked })
              }}
            />
          ))}
        </div>
      ) : (
        <JobAlertEmptyState createBlocked={createBlocked} onCreate={openCreate} />
      )}

      <JobAlertFormModal
        open={editor?.mode === 'edit'}
        alert={editor?.alert}
        catalogError={categoriesQuery.isError || provincesQuery.isError}
        catalogRetrying={categoriesQuery.isFetching || provincesQuery.isFetching}
        email={user?.email}
        categories={categoriesQuery.data || []}
        categoriesLoading={categoriesQuery.isPending}
        provinces={provincesQuery.data || []}
        provincesLoading={provincesQuery.isPending}
        saving={editMutation.isPending}
        onCancel={() => setEditor(null)}
        onRetryCatalog={() => Promise.all([categoriesQuery.refetch(), provincesQuery.refetch()])}
        onSubmit={handleSubmit}
      />
      <CreateJobAlertModal
        open={editor?.mode === 'create'}
        initialValues={editor?.initialValues}
        onClose={() => setEditor(null)}
      />
    </section>
  )
}
