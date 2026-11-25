import { MergeCellsOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { Button, Drawer, Form, Input, Select, Switch } from 'antd'
import { useEffect, useMemo } from 'react'
import { createAdminSkill, updateAdminSkill } from '@/entities/system/admin-catalog'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { formatDateTime } from '@/shared/lib/date-time'
import { message } from '@/shared/lib/toast'
import useConfirmAction from '@/shared/ui/confirm-action/use-confirm-action'
import { SOURCE_LABELS, apiFieldErrors, groupOptions, usageText } from '../model/skill-catalog'

const FIELDS = ['name', 'group', 'aliases', 'description', 'is_active']

function skillValues(skill) {
  return {
    name: skill.name ?? '',
    group: skill.group ?? null,
    aliases: skill.aliases ?? [],
    description: skill.description ?? '',
    is_active: skill.is_active ?? true,
  }
}

/**
 * Ngăn kéo thêm/sửa kỹ năng. `skill` là `{}` khi thêm mới. "Lưu & tiếp" mở luôn
 * kỹ năng kế tiếp trong danh sách đang lọc để dọn liên tục.
 */
export default function SkillDrawer({ skill, groups, nextSkill, canMerge, onClose, onSaved, onMerge }) {
  const [form] = Form.useForm()
  const { confirmationModal, requestConfirmation } = useConfirmAction()
  const editing = Boolean(skill?.id)
  const initialValues = useMemo(() => skillValues(skill ?? {}), [skill])
  const options = groupOptions(groups)

  // Cùng một form store được dùng lại khi "Lưu & tiếp" đổi kỹ năng, nên phải nạp lại
  // giá trị đầu và xóa trạng thái đã sửa của kỹ năng trước.
  useEffect(() => {
    if (skill) form.resetFields()
  }, [form, skill, initialValues])

  const save = useMutation({
    mutationFn: ({ values }) => (editing ? updateAdminSkill(skill.id, values) : createAdminSkill(values)),
    onSuccess: (saved, { next }) => {
      message.success(editing ? m.admin_catalog_skill_saved({ name: saved.name }) : m.admin_catalog_skill_created({ name: saved.name }))
      onSaved(next)
    },
    onError: (error) => {
      const fields = apiFieldErrors(error, FIELDS)
      if (fields.length) form.setFields(fields)
      else message.error(getApiErrorMessage(error, m.admin_catalog_action_failed()))
    },
  })

  const submit = (next = null) => form.validateFields()
    .then((values) => save.mutate({ values, next }))
    .catch(() => {})
  const close = () => {
    if (!form.isFieldsTouched()) return onClose()
    return requestConfirmation({
      title: m.admin_catalog_discard_title(),
      description: m.admin_catalog_discard_description(),
      confirmText: m.admin_catalog_discard(),
      cancelText: m.admin_catalog_keep_editing(),
      danger: true,
      onConfirm: onClose,
    })
  }
  const onKeyDown = (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      submit()
    }
  }

  return (
    <Drawer
      open={Boolean(skill)}
      size="min(420px, 100vw)"
      title={editing ? m.admin_catalog_edit_skill() : m.admin_catalog_add_skill()}
      onClose={close}
      destroyOnHidden
      footer={(
        <div className="skill-drawer__footer">
          {editing && canMerge && (
            <Button icon={<MergeCellsOutlined />} onClick={() => onMerge(skill)}>{m.admin_catalog_merge_action()}</Button>
          )}
          <span className="skill-drawer__spacer" />
          {editing && nextSkill && (
            <Button loading={save.isPending && Boolean(save.variables?.next)} onClick={() => submit(nextSkill)}>{m.admin_catalog_save_next()}</Button>
          )}
          <Button type="primary" loading={save.isPending && !save.variables?.next} onClick={() => submit()}>{m.admin_catalog_save()}</Button>
        </div>
      )}
    >
      <div onKeyDown={onKeyDown}>
        {editing && (
          <p className="skill-drawer__meta">
            {usageText(skill.usage)} · {SOURCE_LABELS[skill.source]()} · {formatDateTime(skill.created_at)}
          </p>
        )}
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={initialValues}
          onFinish={(values) => save.mutate({ values, next: null })}
        >
          <Form.Item name="name" label={m.admin_catalog_col_name()} validateTrigger="onBlur" rules={[{ required: true, whitespace: true, message: m.admin_catalog_name_required() }]}>
            <Input maxLength={255} autoFocus={!editing} />
          </Form.Item>
          <Form.Item name="group" label={m.admin_catalog_col_group()}>
            <Select allowClear placeholder={m.admin_catalog_no_group()} options={options} showSearch={{ optionFilterProp: 'label' }} />
          </Form.Item>
          <Form.Item name="aliases" label={m.admin_catalog_col_aliases()} extra={m.admin_catalog_aliases_help()}>
            <Select mode="tags" open={false} suffixIcon={null} tokenSeparators={[',']} placeholder={m.admin_catalog_aliases_placeholder()} />
          </Form.Item>
          <Form.Item name="description" label={m.admin_catalog_description()}>
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} />
          </Form.Item>
          <Form.Item name="is_active" label={m.admin_catalog_col_active()} valuePropName="checked" extra={m.admin_catalog_active_help()}>
            <Switch />
          </Form.Item>
        </Form>
      </div>
      {confirmationModal}
    </Drawer>
  )
}
