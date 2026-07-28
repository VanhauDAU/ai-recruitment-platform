import { CloseCircleOutlined } from '@ant-design/icons'
import { Button, DatePicker, Input, Select } from 'antd'
import {
  ADVANCED_KEYS,
  BOOLEAN_OPTIONS,
  clearedAdvanced,
  isFilled,
} from '../model/account-filter-options'

const { RangePicker } = DatePicker

function Field({ label, hint, children }) {
  return (
    <label className="account-filter-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

/** Nội dung dùng chung cho popover (desktop) và drawer (mobile). */
export default function AccountAdvancedFilters({
  filters,
  departments,
  roles,
  recruiterOnly = false,
  onChange,
  onDone,
}) {
  const patch = (name, value) => onChange({ ...filters, [name]: value })
  const advancedKeys = recruiterOnly
    ? ADVANCED_KEYS.filter((key) => !['department', 'admin_role'].includes(key))
    : ADVANCED_KEYS.filter((key) => ![
      'company',
      'company_state',
      'verification_status',
    ].includes(key))
  const activeCount = advancedKeys.filter((key) => isFilled(filters[key])).length

  return (
    <div className="account-filter-popover">
      <section>
        <h4>Trạng thái &amp; bảo mật</h4>
        <div className="account-filter-grid">
          <Field label="Xác minh email">
            <Select
              value={filters.email_verified}
              onChange={(value) => patch('email_verified', value)}
              options={BOOLEAN_OPTIONS}
            />
          </Field>
          <Field label="Đã bật MFA">
            <Select
              value={filters.mfa}
              onChange={(value) => patch('mfa', value)}
              options={BOOLEAN_OPTIONS}
            />
          </Field>
          <Field
            label="Có phiên hoạt động"
            hint="Tài khoản đang đăng nhập trên ít nhất một thiết bị"
          >
            <Select
              value={filters.has_active_session}
              onChange={(value) => patch('has_active_session', value)}
              options={BOOLEAN_OPTIONS}
            />
          </Field>
          {recruiterOnly && (
            <>
              <Field label="Mã công ty">
                <Input
                  allowClear
                  placeholder="Ví dụ: co_..."
                  value={filters.company}
                  onChange={(event) => patch('company', event.target.value)}
                />
              </Field>
              <Field label="Liên kết công ty">
                <Select
                  value={filters.company_state}
                  onChange={(value) => patch('company_state', value)}
                  options={[
                    { value: '', label: 'Mọi trạng thái liên kết' },
                    { value: 'linked', label: 'Đã liên kết công ty' },
                    { value: 'missing', label: 'Chưa liên kết công ty' },
                  ]}
                />
              </Field>
              <Field label="Xác thực đại diện">
                <Select
                  value={filters.verification_status}
                  onChange={(value) => patch('verification_status', value)}
                  options={[
                    { value: '', label: 'Mọi trạng thái xác thực' },
                    { value: 'none', label: 'Chưa có hồ sơ' },
                    { value: 'draft', label: 'Chưa nộp' },
                    { value: 'pending', label: 'Chờ duyệt' },
                    { value: 'in_review', label: 'Đang xử lý' },
                    { value: 'changes_requested', label: 'Cần bổ sung' },
                    { value: 'approved', label: 'Đã xác thực' },
                    { value: 'rejected', label: 'Bị từ chối' },
                  ]}
                />
              </Field>
            </>
          )}
        </div>
      </section>

      {!recruiterOnly && (
        <section>
          <h4>Phân quyền quản trị</h4>
          <div className="account-filter-grid">
            <Field label="Phòng ban Admin">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Chọn phòng ban"
                value={filters.department || undefined}
                onChange={(value) => patch('department', value || '')}
                options={departments.map((item) => ({
                  value: item.public_id,
                  label: item.name,
                }))}
              />
            </Field>
            <Field label="Chức danh Admin">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Chọn chức danh"
                value={filters.admin_role || undefined}
                onChange={(value) => patch('admin_role', value || '')}
                options={roles.map((item) => ({
                  value: item.public_id,
                  label: `${item.department.name} · ${item.name}`,
                }))}
              />
            </Field>
          </div>
        </section>
      )}

      <section>
        <h4>Mốc thời gian</h4>
        <div className="account-filter-grid">
          <Field label="Ngày tạo tài khoản">
            <RangePicker
              value={filters.created_range?.length ? filters.created_range : null}
              onChange={(value) => patch('created_range', value || [])}
              format="DD/MM/YYYY"
              placeholder={['Từ ngày', 'Đến ngày']}
            />
          </Field>
          <Field label="Lần đăng nhập gần nhất">
            <RangePicker
              value={filters.last_login_range?.length ? filters.last_login_range : null}
              onChange={(value) => patch('last_login_range', value || [])}
              format="DD/MM/YYYY"
              placeholder={['Từ ngày', 'Đến ngày']}
            />
          </Field>
        </div>
      </section>

      <footer className="account-filter-popover__footer">
        <span>
          {activeCount > 0
            ? `${activeCount} điều kiện nâng cao đang áp dụng`
            : 'Chưa áp dụng điều kiện nâng cao'}
        </span>
        <div>
          <Button
            size="small"
            icon={<CloseCircleOutlined />}
            disabled={activeCount === 0}
            onClick={() => onChange({ ...filters, ...clearedAdvanced() })}
          >
            Đặt lại
          </Button>
          <Button size="small" type="primary" onClick={onDone}>
            Xong
          </Button>
        </div>
      </footer>
    </div>
  )
}
