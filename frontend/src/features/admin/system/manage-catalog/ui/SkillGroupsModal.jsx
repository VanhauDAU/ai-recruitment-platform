import { PlusOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Input, Modal, Select, Switch, Table, Tag, Typography } from 'antd'
import { useState } from 'react'
import { adminCatalogKeys, createAdminSkillGroup, updateAdminSkillGroup } from '@/entities/system/admin-catalog'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import { formatCount } from '../model/catalog'

/** Danh sách nhóm kỹ năng sửa ngay trên dòng; hai nhóm hệ thống chỉ xem. */
export default function SkillGroupsModal({ open, groups, loading, onClose }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const refresh = () => queryClient.invalidateQueries({ queryKey: adminCatalogKeys.root })
  const onError = (error) => message.error(getApiErrorMessage(error, m.admin_catalog_action_failed()))
  const create = useMutation({
    mutationFn: () => createAdminSkillGroup({ name: name.trim() }),
    onSuccess: (group) => {
      setName('')
      refresh()
      message.success(m.admin_catalog_group_created({ name: group.name }))
    },
    onError,
  })
  const update = useMutation({
    mutationFn: ({ group, changes }) => updateAdminSkillGroup(group.id, changes),
    onSuccess: refresh,
    onError,
  })
  const save = (group, changes) => update.mutate({ group, changes })

  const columns = [
    {
      key: 'name',
      title: m.admin_catalog_col_name(),
      render: (group) => (group.is_system ? (
        <span>{group.name} <Tag>{m.admin_catalog_group_system()}</Tag></span>
      ) : (
        <Typography.Text editable={{ onChange: (value) => value.trim() && value !== group.name && save(group, { name: value }) }}>
          {group.name}
        </Typography.Text>
      )),
    },
    {
      key: 'parent',
      title: m.admin_catalog_group_parent(),
      width: 180,
      render: (group) => (
        <Select
          size="small"
          allowClear
          className="skill-groups__parent"
          placeholder={m.admin_catalog_group_no_parent()}
          aria-label={m.admin_catalog_group_parent_for({ name: group.name })}
          value={group.parent}
          options={groups.filter((item) => item.id !== group.id).map((item) => ({ value: item.id, label: item.name }))}
          onChange={(parent) => save(group, { parent: parent ?? null })}
        />
      ),
    },
    { key: 'count', title: m.admin_catalog_group_skill_count(), width: 90, align: 'right', render: (group) => formatCount(group.skill_count) },
    {
      key: 'active',
      title: m.admin_catalog_col_active(),
      width: 64,
      render: (group) => (
        <Switch
          size="small"
          checked={group.is_active}
          disabled={group.is_system}
          aria-label={m.admin_catalog_toggle_group({ name: group.name })}
          onChange={(active) => save(group, { is_active: active })}
        />
      ),
    },
  ]

  return (
    <Modal open={open} title={m.admin_catalog_groups()} footer={null} width={680} onCancel={onClose}>
      <form
        className="skill-groups__add"
        onSubmit={(event) => {
          event.preventDefault()
          if (name.trim()) create.mutate()
        }}
      >
        <Input value={name} maxLength={255} placeholder={m.admin_catalog_group_new()} aria-label={m.admin_catalog_group_new()} onChange={(event) => setName(event.target.value)} />
        <Button htmlType="submit" icon={<PlusOutlined />} loading={create.isPending}>{m.admin_catalog_group_add()}</Button>
      </form>
      <Table rowKey="id" size="small" columns={columns} dataSource={groups} loading={loading} pagination={false} scroll={{ x: 520, y: 420 }} />
    </Modal>
  )
}
