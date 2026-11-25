import { ArrowRightOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Alert, Modal, Select, Skeleton } from 'antd'
import { useState } from 'react'
import {
  adminCatalogKeys,
  getAdminSkillMergePreview,
  getAdminSkills,
  mergeAdminSkill,
} from '@/entities/system/admin-catalog'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import useDebouncedValue from '@/shared/hooks/use-debounced-value'
import { message } from '@/shared/lib/toast'
import { usageText } from '../model/catalog'

/** Gộp `source` vào kỹ năng khác; xem trước số dòng sẽ chuyển rồi mới xác nhận. */
export default function SkillMergeModal({ source, onClose, onMerged }) {
  const [target, setTarget] = useState(null)
  const [search, setSearch] = useState('')
  const term = useDebouncedValue(search, 300)
  const candidates = useQuery({
    queryKey: adminCatalogKeys.skills({ search: term, page_size: 20, merge: true }),
    queryFn: ({ signal }) => getAdminSkills({ search: term, page_size: 20 }, { signal }),
    enabled: Boolean(source),
  })
  const preview = useQuery({
    queryKey: adminCatalogKeys.mergePreview(source?.id, target?.id),
    queryFn: ({ signal }) => getAdminSkillMergePreview(source.id, target.id, { signal }),
    enabled: Boolean(source && target),
  })
  const merge = useMutation({
    mutationFn: () => mergeAdminSkill(source.id, target.id),
    onSuccess: onMerged,
    onError: (error) => message.error(getApiErrorMessage(error, m.admin_catalog_action_failed())),
  })
  const options = (candidates.data?.results ?? [])
    .filter((skill) => skill.id !== source?.id)
    .map((skill) => ({ value: skill.id, label: skill.name, skill }))
  const dropped = preview.data ? Object.values(preview.data.dropped).reduce((sum, count) => sum + count, 0) : 0

  return (
    <Modal
      open={Boolean(source)}
      title={m.admin_catalog_merge_title({ name: source?.name ?? '' })}
      okText={target ? m.admin_catalog_merge_into({ name: target.name }) : m.admin_catalog_merge_action()}
      cancelText={m.admin_catalog_merge_cancel()}
      okButtonProps={{ danger: true, disabled: !preview.isSuccess, loading: merge.isPending }}
      onOk={() => merge.mutate()}
      onCancel={onClose}
      afterClose={() => {
        setTarget(null)
        setSearch('')
      }}
      destroyOnHidden
    >
      <div className="skill-merge">
        <Select
          showSearch={{ filterOption: false, onSearch: setSearch }}
          autoFocus
          className="skill-merge__target"
          placeholder={m.admin_catalog_merge_target()}
          aria-label={m.admin_catalog_merge_target()}
          loading={candidates.isFetching}
          options={options}
          value={target?.id}
          onChange={(_, option) => setTarget(option.skill)}
          notFoundContent={candidates.isFetching ? null : m.admin_catalog_merge_no_match()}
        />
        {target && (
          <div className="skill-merge__pair">
            <span className="skill-merge__skill is-source">{source.name}</span>
            <ArrowRightOutlined aria-hidden="true" />
            <span className="skill-merge__skill">{target.name}</span>
          </div>
        )}
        {preview.isFetching && <Skeleton active title={false} paragraph={{ rows: 2 }} />}
        {preview.isSuccess && !preview.isFetching && (
          <>
            <p className="skill-merge__moved">{m.admin_catalog_merge_moved({ usage: usageText(preview.data.moved) })}</p>
            {dropped > 0 && <p className="skill-merge__dropped">{m.admin_catalog_merge_dropped({ usage: usageText(preview.data.dropped) })}</p>}
            <Alert type="warning" showIcon message={m.admin_catalog_merge_warning({ source: source.name, target: target.name })} />
          </>
        )}
      </div>
    </Modal>
  )
}
