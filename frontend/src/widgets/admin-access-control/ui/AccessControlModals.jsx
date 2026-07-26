import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Typography,
} from 'antd'
import { IMPACT_COPY } from '../model/access-control-view'
import { ImpactDetails } from './AccessControlFeedback'
import PermissionPicker from './PermissionPicker'

export default function AccessControlModals({
  department,
  role,
  permission,
  assignment,
  impact,
}) {
  return (
    <>
      <Modal
        title={department.editor?.row ? 'Chỉnh sửa phòng ban' : 'Tạo phòng ban'}
        open={Boolean(department.editor)}
        onCancel={department.onClose}
        onOk={department.onSave}
        okText={department.editor?.row ? 'Lưu thay đổi' : 'Tạo phòng ban'}
        confirmLoading={department.saving}
        width={680}
        destroyOnHidden
      >
        <Form form={department.form} layout="vertical" requiredMark="optional">
          <Form.Item name="name" label="Tên phòng ban" rules={[{ required: true, message: 'Nhập tên phòng ban.' }]}>
            <Input size="large" autoFocus placeholder="Ví dụ: Nội dung & CV" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả (tuỳ chọn)">
            <Input.TextArea rows={4} showCount maxLength={500} placeholder="Phạm vi công việc hoặc mục đích của phòng ban" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={role.editor?.row ? 'Chỉnh sửa chức danh' : 'Tạo chức danh'}
        open={Boolean(role.editor)}
        onCancel={role.onClose}
        onOk={role.onSave}
        okText={role.editor?.row ? 'Lưu thay đổi' : 'Tạo chức danh'}
        confirmLoading={role.saving}
        width={680}
        destroyOnHidden
      >
        <Form form={role.form} layout="vertical" requiredMark="optional">
          {!role.editor?.row && (
            <Form.Item name="department" label="Phòng ban" rules={[{ required: true, message: 'Chọn phòng ban.' }]}>
              <Select
                size="large"
                placeholder="Chọn phòng ban sở hữu chức danh này"
                options={role.departments.map((item) => ({
                  value: item.public_id,
                  label: item.name,
                }))}
              />
            </Form.Item>
          )}
          <Form.Item name="name" label="Tên chức danh" rules={[{ required: true, message: 'Nhập tên chức danh.' }]}>
            <Input size="large" placeholder="Ví dụ: Chuyên viên kiểm duyệt" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả (tuỳ chọn)">
            <Input.TextArea rows={3} showCount maxLength={500} placeholder="Trách nhiệm chính của chức danh" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Sửa quyền · ${permission.editor?.name || ''}`}
        open={Boolean(permission.editor)}
        onCancel={permission.onClose}
        onOk={permission.onPreview}
        okText="Xem tác động"
        okButtonProps={{ disabled: permission.query.isLoading || permission.query.isError }}
        width={920}
        destroyOnHidden
      >
        <PermissionPicker
          permissions={permission.query.data}
          value={permission.codes}
          onChange={permission.onCodesChange}
          loading={permission.query.isLoading}
          error={permission.query.error}
        />
      </Modal>

      <Modal
        title={assignment.member ? 'Đổi chức danh' : 'Gán chức danh'}
        open={assignment.open}
        onCancel={assignment.onClose}
        onOk={assignment.onPreview}
        okText="Xem thay đổi"
        width={680}
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary" className="!mb-5">
          {assignment.member
            ? 'Chức danh cũ sẽ được thay bằng chức danh mới sau khi bạn xác nhận tác động.'
            : 'Chọn nhân viên và chức danh. Bạn sẽ xem được quyền thay đổi trước khi xác nhận.'}
        </Typography.Paragraph>
        <Form form={assignment.form} layout="vertical">
          {assignment.member ? (
            <>
              <Form.Item name="user_public_id" hidden><Input /></Form.Item>
              <Card size="small" className="!mb-5 border-slate-200 bg-slate-50">
                <Typography.Text strong>{assignment.member.user.full_name || assignment.member.user.email}</Typography.Text>
                {assignment.member.user.full_name && (
                  <div><Typography.Text type="secondary">{assignment.member.user.email}</Typography.Text></div>
                )}
                <div className="mt-2 text-sm text-slate-600">
                  Hiện tại: <strong>{assignment.member.role.name}</strong> · {assignment.member.department.name}
                </div>
              </Card>
            </>
          ) : (
            <Form.Item
              name="user_public_id"
              label="Nhân viên"
              rules={[{ required: true, message: 'Chọn nhân viên.' }]}
            >
              <Select
                showSearch
                filterOption={false}
                onSearch={assignment.onSearch}
                loading={assignment.staffQuery.isFetching}
                placeholder="Nhập email hoặc họ tên"
                options={assignment.staff.map((item) => ({
                  value: item.public_id,
                  label: `${item.full_name || item.email}${item.full_name ? ` · ${item.email}` : ''}`,
                }))}
                notFoundContent={assignment.staffQuery.isLoading ? 'Đang tìm…' : 'Không tìm thấy tài khoản'}
              />
            </Form.Item>
          )}
          <Form.Item name="role_public_id" label="Chức danh mới" rules={[{ required: true, message: 'Chọn chức danh.' }]}>
            <Select
              size="large"
              showSearch
              optionFilterProp="label"
              placeholder="Chọn chức danh"
              loading={assignment.rolesQuery.isLoading}
              options={assignment.roleOptions}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={impact.value ? IMPACT_COPY[impact.value.kind]?.title : ''}
        open={Boolean(impact.value)}
        onCancel={impact.onClose}
        onOk={impact.onApply}
        okText={impact.value ? IMPACT_COPY[impact.value.kind]?.ok : 'Xác nhận'}
        confirmLoading={impact.value?.confirming}
        okButtonProps={{
          danger: ['departmentStatus', 'roleStatus', 'revoke'].includes(impact.value?.kind),
          disabled: (
            impact.value?.loading
            || Boolean(impact.value?.error)
            || !impact.value?.preview
            || impact.value?.preview?.can_apply === false
          ),
        }}
        width={760}
        destroyOnHidden
      >
        {impact.value?.loading && <Card loading aria-label="Đang tải tác động" />}
        {impact.value?.error && (
          <Alert
            showIcon
            type="error"
            title={impact.value.error}
            action={(
              <Button className="min-h-11" onClick={impact.onReload}>
                Tải lại
              </Button>
            )}
          />
        )}
        <ImpactDetails preview={impact.value?.preview} stale={impact.value?.stale} />
      </Modal>
    </>
  )
}
