import { PlusOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Select, Spin } from 'antd'
import { useMemo, useState } from 'react'
import {
  adminBlogKeys,
  createAdminBlogTag,
} from '@/entities/blog'
import { message } from '@/shared/lib/toast'
import { findMatchingTags, hasExactTag, normalizeTagName } from '../model/tag-options'

const CREATE_VALUE = '__create_new_tag__'

export default function BlogTagPicker({ value = [], onChange, tags = [], loading = false, error = false, disabled = false }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const activeTags = useMemo(() => tags.filter((tag) => tag.is_active), [tags])
  const matches = useMemo(() => findMatchingTags(activeTags, search), [activeTags, search])
  const createName = normalizeTagName(search)
  const canCreate = createName.length >= 2 && !hasExactTag(tags, search)
  const selectedHidden = tags.filter((tag) => !tag.is_active && value.includes(tag.public_id))
  const options = [
    ...matches.map((tag) => ({ value: tag.public_id, label: tag.name })),
    ...selectedHidden.map((tag) => ({ value: tag.public_id, label: `${tag.name} (đã ẩn)`, disabled: true })),
    ...(canCreate ? [{ value: CREATE_VALUE, label: `Tạo thẻ mới “${createName}”`, create: true }] : []),
  ]

  const createMutation = useMutation({
    mutationFn: () => createAdminBlogTag({ name: createName }),
    onSuccess: (created) => {
      queryClient.setQueryData(adminBlogKeys.tags(), (current = []) => [...current, created])
      onChange?.([...value, created.public_id])
      setSearch('')
      message.success(`Đã tạo thẻ “${created.name}”.`)
    },
    onError: (error) => {
      const detail = error.response?.data?.name?.[0]
      message.error(detail || 'Không thể tạo thẻ. Hãy chọn thẻ hiện có hoặc thử tên khác.')
    },
  })

  const handleChange = (nextValue) => {
    if (nextValue.includes(CREATE_VALUE)) return
    onChange?.(nextValue)
  }

  const handleSelect = (selected) => {
    if (selected === CREATE_VALUE && !createMutation.isPending) createMutation.mutate()
  }

  return (
    <Select
      mode="multiple"
      value={value}
      disabled={disabled}
      loading={loading || createMutation.isPending}
      showSearch
      searchValue={search}
      onSearch={setSearch}
      onChange={handleChange}
      onSelect={handleSelect}
      filterOption={false}
      options={options}
      placeholder="Tìm kiếm hoặc nhập tên thẻ…"
      notFoundContent={loading ? <Spin size="small" /> : error ? 'Không thể tải danh sách thẻ. Hãy tải lại trang.' : 'Không tìm thấy thẻ phù hợp'}
      optionRender={(option) => option.data.create
        ? <span className="font-medium text-[var(--brand-primary)]"><PlusOutlined className="mr-2" />{option.label}</span>
        : option.label}
      maxTagCount="responsive"
      className="w-full"
      aria-label="Thẻ bài viết"
    />
  )
}
