import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Switch,
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
        title={department.editor?.row ? 'Sửa phòng ban' : 'Thêm phòng ban'}
        open={Boolean(department.editor)}
        onCancel={department.onClose}
        onOk={department.onSave}
        okText="Lưu phòng ban"
        confirmLoading={department.saving}
        width={680}
        destroyOnHidden
      >
        <Form form={department.form} layout="vertical">
          <Form.Item name="code" label="Mã phòng ban" rules={[{ required: true, message: 'Nhập mã phòng ban.' }]}>
            <Input disabled={Boolean(department.editor?.row)} placeholder="content-operations" />
          </Form.Item>
          <Form.Item name="name" label="Tên phòng ban" rules={[{ required: true, message: 'Nhập tên phòng ban.' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={role.editor?.row ? 'Sửa chức danh' : 'Thêm chức danh'}
        open={Boolean(role.editor)}
        onCancel={role.onClose}
        onOk={role.onSave}
        okText="Lưu chức danh"
        confirmLoading={role.saving}
        width={680}
        destroyOnHidden
      >
        <Form form={role.form} layout="vertical">
          {!role.editor?.row && (
            <Form.Item name="department" label="Phòng ban" rules={[{ required: true, message: 'Chọn phòng ban.' }]}>
              <Select
                options={role.departments.map((item) => ({
                  value: item.public_id,
                  label: item.name,
                }))}
              />
            </Form.Item>
          )}
          {!role.editor?.row && (
            <Form.Item name="code" label="Mã chức danh" rules={[{ required: true, message: 'Nhập mã chức danh.' }]}>
              <Input placeholder="reviewer" />
            </Form.Item>
          )}
          <Form.Item name="name" label="Tên chức danh" rules={[{ required: true, message: 'Nhập tên chức danh.' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Mô tả"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="rank" label="Rank" extra="Rank chỉ dùng cho hiển thị và chọn phòng ban chính; không cấp quyền.">
            <InputNumber min={0} max={32767} className="w-full" />
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
        <Alert
          showIcon
          type="info"
          className="!mb-4"
          title="Quyền đã ngừng sử dụng được giữ nguyên để hỗ trợ rollback."
        />
        <PermissionPicker
          permissions={permission.query.data}
          value={permission.codes}
          onChange={permission.onCodesChange}
          loading={permission.query.isLoading}
          error={permission.query.error}
        />
      </Modal>

      <Modal
        title="Gán nhân viên vào chức danh"
        open={assignment.open}
        onCancel={assignment.onClose}
        onOk={assignment.onPreview}
        okText="Xem tác động"
        width={680}
        destroyOnHidden
      >
        <Form form={assignment.form} layout="vertical" initialValues={{ is_primary: false }}>
          <Form.Item
            name="user_public_id"
            label="Nhân viên"
            extra="Tìm trong các tài khoản admin đang hoạt động."
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
          <Form.Item name="role_public_id" label="Chức danh" rules={[{ required: true, message: 'Chọn chức danh.' }]}>
            <Select
              loading={assignment.rolesQuery.isLoading}
              options={assignment.roleOptions}
            />
          </Form.Item>
          <Form.Item
            name="is_primary"
            label="Đặt làm phòng ban chính"
            valuePropName="checked"
            extra="Nếu đây là membership đầu tiên, hệ thống sẽ tự đặt làm chính."
          >
            <Switch />
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
