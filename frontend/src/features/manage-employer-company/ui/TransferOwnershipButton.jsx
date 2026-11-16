import { SwapOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Button, Modal, Select } from 'antd'
import { useState } from 'react'
import { employerCompanyPageKeys, getEmployerCompanyPageEditors } from '@/entities/employer-company-page'
import { transferCompanyOwnership } from '@/entities/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

/** The verified owner hands the company to a verified member, then becomes a member. */
export default function TransferOwnershipButton({ onTransferred }) {
  const [open, setOpen] = useState(false)
  const [memberId, setMemberId] = useState()
  const membersQuery = useQuery({
    queryKey: employerCompanyPageKeys.editors,
    queryFn: ({ signal }) => getEmployerCompanyPageEditors({ signal }),
    enabled: open,
  })
  const candidates = (membersQuery.data || []).filter((row) => row.company_role === 'member' && row.eligible)
  const transfer = useMutation({
    mutationFn: () => transferCompanyOwnership(memberId),
    onSuccess: async () => {
      message.success('Đã chuyển quyền owner. Bạn hiện là thành viên của công ty.')
      setOpen(false)
      await onTransferred?.()
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể chuyển quyền owner.')),
  })

  return (
    <>
      <Button size="small" icon={<SwapOutlined />} onClick={() => setOpen(true)}>Chuyển quyền owner</Button>
      <Modal
        open={open}
        title="Chuyển quyền owner công ty"
        okText="Chuyển quyền"
        cancelText="Đóng"
        okButtonProps={{ danger: true, disabled: !memberId, loading: transfer.isPending }}
        onOk={() => transfer.mutate()}
        onCancel={() => setOpen(false)}
        destroyOnHidden
      >
        <p className="mb-3 text-sm text-slate-600">
          Chỉ chọn được thành viên đã xác thực tài khoản. Sau khi chuyển, owner mới duyệt yêu cầu tham gia và quản lý trang công ty; bạn trở thành thành viên.
        </p>
        <Select
          className="w-full"
          aria-label="Chọn thành viên nhận quyền owner"
          placeholder="Chọn thành viên"
          loading={membersQuery.isLoading}
          value={memberId}
          onChange={setMemberId}
          notFoundContent="Chưa có thành viên nào đã xác thực tài khoản"
          options={candidates.map((row) => ({
            value: row.member_id,
            label: [row.display_name || row.email_masked, row.position_title].filter(Boolean).join(' · '),
          }))}
        />
      </Modal>
    </>
  )
}
