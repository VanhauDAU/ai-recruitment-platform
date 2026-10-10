import {
  CheckCircleOutlined,
  EditOutlined,
  InboxOutlined,
  PlusOutlined,
  SyncOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { Button, Input, Modal, Space, Switch, Table, Tabs, Tag, Typography, Upload } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  activateAdminCvBlueprint,
  archiveAdminCvBackground,
  archiveAdminCvSample,
  createAdminCvBackground,
  createAdminTemplateVersion,
  getAdminCvBlueprints,
  getAdminCvBackgrounds,
  getAdminCvCategories,
  getAdminCvColors,
  getAdminCvSamples,
  getAdminCvTemplates,
  publishAdminCvSample,
  publishAdminTemplateVersion,
  regenerateAdminTemplateSnapshots,
  updateAdminCvBackground,
  updateAdminCvSample,
} from '@/entities/cv-template'
import { getAdminLocales } from '@/entities/locale'
import { message } from '@/shared/lib/toast'
import { AdminDataActions, AdminPanel } from '@/shared/ui/admin'

function statusTag(value) {
  const color = value === 'published' || value === true ? 'green' : value === 'draft' ? 'gold' : 'default'
  const labels = {
    archived: 'Đã lưu trữ',
    draft: 'Bản nháp',
    published: 'Đã phát hành',
    true: 'Đang bật',
    false: 'Đang tắt',
  }
  return <Tag color={color}>{labels[String(value)] || String(value)}</Tag>
}

function compareText(field) {
  return (left, right) => String(left[field] || '').localeCompare(
    String(right[field] || ''),
    'vi',
  )
}

function compareBoolean(field) {
  return (left, right) => Number(Boolean(left[field])) - Number(Boolean(right[field]))
}

function filterRows(rows, query, fields) {
  if (!query) return rows
  return rows.filter((row) => fields.some((field) => (
    String(row[field] || '').toLocaleLowerCase('vi').includes(query)
  )))
}

const EXPORT_COLUMNS = {
  templates: [
    { key: 'public_id', label: 'Mã template' },
    { key: 'name', label: 'Tên template' },
    { key: 'lifecycle_status', label: 'Vòng đời' },
    { key: 'current_published_version_id', label: 'Version hiện tại' },
  ],
  samples: [
    { key: 'public_id', label: 'Mã nội dung mẫu' },
    { key: 'title', label: 'Tên nội dung' },
    { key: 'position_name_vi', label: 'Vị trí' },
    { key: 'locale', label: 'Ngôn ngữ' },
    { key: 'experience_level', label: 'Cấp độ kinh nghiệm' },
    { key: 'status', label: 'Trạng thái' },
  ],
  blueprints: [
    { key: 'public_id', label: 'Mã blueprint' },
    { key: 'locale', label: 'Ngôn ngữ' },
    { key: 'experience_level', label: 'Cấp độ' },
    { key: 'is_active', label: 'Đang bật' },
  ],
  locales: [
    { key: 'code', label: 'Mã ngôn ngữ' },
    { key: 'label_vi', label: 'Tên' },
    { key: 'catalog_path', label: 'Đường dẫn catalogue' },
    { key: 'is_default', label: 'Mặc định' },
    { key: 'is_active', label: 'Đang bật' },
  ],
  taxonomy: [
    { key: 'record_type', label: 'Nhóm dữ liệu' },
    { key: 'name', label: 'Tên' },
    { key: 'value', label: 'Giá trị' },
  ],
  backgrounds: [
    { key: 'public_id', label: 'Mã hình nền' },
    { key: 'title', label: 'Tên hình nền' },
    { key: 'width', label: 'Rộng (px)' },
    { key: 'height', label: 'Cao (px)' },
    { key: 'is_active', label: 'Đang dùng' },
  ],
}

function StructuredSampleEditor({ sample, open, onClose, onSaved }) {
  const [draft, setDraft] = useState(sample)
  const [saving, setSaving] = useState(false)

  useEffect(() => setDraft(sample), [sample])
  if (!draft) return null

  const patchSection = (sectionIndex, patch) => {
    const content = structuredClone(draft.content_json)
    content.sections[sectionIndex] = { ...content.sections[sectionIndex], ...patch }
    setDraft({ ...draft, content_json: content })
  }
  const patchItem = (sectionIndex, itemIndex, key, value) => {
    const content = structuredClone(draft.content_json)
    content.sections[sectionIndex].items[itemIndex][key] = value
    setDraft({ ...draft, content_json: content })
  }
  const save = async () => {
    setSaving(true)
    try {
      const saved = await updateAdminCvSample(draft.public_id, {
        title: draft.title,
        position_name_vi: draft.position_name_vi,
        locale: draft.locale,
        experience_level: draft.experience_level,
        content_json: draft.content_json,
        schema_version: draft.schema_version,
      })
      message.success('Đã lưu nội dung mẫu dạng draft.')
      onSaved(saved)
    } catch {
      message.error('Không thể lưu. Hãy kiểm tra schema và locale của nội dung.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Biên tập nội dung CV mẫu" open={open} onCancel={onClose} onOk={save} okText="Lưu bản nháp" cancelText="Hủy" confirmLoading={saving} width={920}>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-2">
        <label className="block text-sm font-medium">Tên nội dung<Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
        <label className="block text-sm font-medium">Tên vị trí tiếng Việt<Input value={draft.position_name_vi} onChange={(event) => setDraft({ ...draft, position_name_vi: event.target.value })} /></label>
        {draft.content_json?.sections?.map((section, sectionIndex) => (
          <section key={section.instance_id} className="rounded-lg border border-slate-200 p-4">
            <Typography.Text strong>{section.section_key}</Typography.Text>
            <Input className="mt-2" addonBefore="Tiêu đề" value={section.title} onChange={(event) => patchSection(sectionIndex, { title: event.target.value })} />
            <div className="mt-3 space-y-3">
              {section.items?.map((item, itemIndex) => (
                <div key={item.item_id} className="rounded bg-slate-50 p-3">
                  {Object.entries(item).filter(([key, value]) => key !== 'item_id' && typeof value === 'string').map(([key, value]) => (
                    <Input key={key} className="mb-2" addonBefore={key} value={value} onChange={(event) => patchItem(sectionIndex, itemIndex, key, event.target.value)} />
                  ))}
                  {item.description?.format === 'rich_text_v1' && (
                    <Input.TextArea
                      rows={3}
                      value={item.description.content?.map((block) => block.text).join('\n') || ''}
                      onChange={(event) => patchItem(sectionIndex, itemIndex, 'description', {
                        format: 'rich_text_v1',
                        content: event.target.value.split('\n').filter(Boolean).map((text) => ({ type: 'paragraph', text })),
                      })}
                    />
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  )
}

export default function AdminCvCatalogue() {
  const [searchParams, setSearchParams] = useSearchParams()
  const allowedTabs = ['templates', 'samples', 'blueprints', 'locales', 'taxonomy', 'backgrounds']
  const requestedTab = searchParams.get('tab') || 'templates'
  const activeTab = allowedTabs.includes(requestedTab) ? requestedTab : 'templates'
  const rawQuery = searchParams.get('q') || ''
  const query = rawQuery.trim().toLocaleLowerCase('vi')
  const [data, setData] = useState({ templates: [], samples: [], blueprints: [], locales: [], categories: [], colors: [], backgrounds: [] })
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [searchDraft, setSearchDraft] = useState(rawQuery)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [templates, samples, blueprints, locales, categories, colors, backgrounds] = await Promise.all([
        getAdminCvTemplates(), getAdminCvSamples(), getAdminCvBlueprints(),
        getAdminLocales(), getAdminCvCategories(), getAdminCvColors(), getAdminCvBackgrounds(),
      ])
      setData({ templates, samples, blueprints, locales, categories, colors, backgrounds })
    } catch {
      message.error('Không thể tải catalogue CV quản trị.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { setSearchDraft(rawQuery) }, [rawQuery])
  const act = async (operation, success) => {
    try {
      await operation()
      message.success(success)
      await load()
    } catch {
      message.error('Thao tác không thành công. Vui lòng kiểm tra trạng thái dữ liệu.')
    }
  }

  const filtered = {
    templates: filterRows(data.templates, query, ['public_id', 'name', 'lifecycle_status']),
    samples: filterRows(data.samples, query, ['public_id', 'title', 'position_name_vi', 'locale', 'experience_level', 'status']),
    blueprints: filterRows(data.blueprints, query, ['public_id', 'locale', 'experience_level']),
    locales: filterRows(data.locales, query, ['code', 'label_vi', 'catalog_path']),
    categories: filterRows(data.categories, query, ['public_id', 'name', 'category_type']),
    colors: filterRows(data.colors, query, ['public_id', 'name', 'hex_code']),
    backgrounds: filterRows(data.backgrounds, query, ['public_id', 'title']),
  }
  const rowsByTab = {
    templates: filtered.templates,
    samples: filtered.samples,
    blueprints: filtered.blueprints,
    locales: filtered.locales,
    taxonomy: [
      ...filtered.categories.map((item) => ({
        ...item,
        record_type: 'Danh mục',
        value: item.category_type,
      })),
      ...filtered.colors.map((item) => ({
        ...item,
        record_type: 'Màu',
        value: item.hex_code,
      })),
    ],
    backgrounds: filtered.backgrounds,
  }

  const updateSearch = (value) => {
    const next = new URLSearchParams(searchParams)
    const normalized = value.trim()
    if (normalized) next.set('q', normalized)
    else next.delete('q')
    setSearchParams(next, { replace: true })
  }

  const templateColumns = [
    { title: 'Template', dataIndex: 'name', sorter: compareText('name') },
    { title: 'Vòng đời', dataIndex: 'lifecycle_status', sorter: compareText('lifecycle_status'), render: statusTag },
    { title: 'Version hiện tại', dataIndex: 'current_published_version_id', sorter: compareText('current_published_version_id'), render: (value) => value || '—' },
    {
      title: 'Thao tác', render: (_, row) => {
        const draft = row.versions?.find((version) => version.version_status === 'draft')
        return <Space wrap>
          <Button icon={<PlusOutlined />} size="small" onClick={() => act(() => createAdminTemplateVersion(row.public_id), 'Đã tạo draft version mới.')}>Tạo version</Button>
          {draft && <Button icon={<CheckCircleOutlined />} size="small" type="primary" onClick={() => act(() => publishAdminTemplateVersion(row.public_id, draft.id), 'Đã publish version.')}>Phát hành draft</Button>}
          <Button icon={<SyncOutlined />} size="small" onClick={() => act(() => regenerateAdminTemplateSnapshots(row.public_id), 'Đã xếp hàng sinh snapshot.')}>Sinh lại snapshot</Button>
        </Space>
      },
    },
  ]
  const sampleColumns = [
    { title: 'Nội dung', dataIndex: 'title', sorter: compareText('title') },
    { title: 'Ngôn ngữ', dataIndex: 'locale', sorter: compareText('locale') },
    { title: 'Trạng thái', dataIndex: 'status', sorter: compareText('status'), render: statusTag },
    { title: 'Thao tác', render: (_, row) => <Space>
      <Button icon={<EditOutlined />} size="small" onClick={() => setEditing(row)}>Sửa cấu trúc</Button>
      {row.status === 'draft' && <Button icon={<CheckCircleOutlined />} size="small" type="primary" onClick={() => act(() => publishAdminCvSample(row.public_id), 'Đã phát hành nội dung mẫu.')}>Phát hành</Button>}
      {row.status !== 'archived' && <Button icon={<InboxOutlined />} size="small" danger onClick={() => act(() => archiveAdminCvSample(row.public_id), 'Đã lưu trữ nội dung mẫu.')}>Lưu trữ</Button>}
    </Space> },
  ]

  return (
    <div className="space-y-5">
      <AdminPanel>
        <div className="admin-list-toolbar" data-print-hide="true">
          <Input.Search
            allowClear
            className="w-full sm:w-80"
            onChange={(event) => setSearchDraft(event.target.value)}
            onSearch={updateSearch}
            placeholder="Tìm trong tab đang mở"
            value={searchDraft}
          />
          <AdminDataActions
            compact
            columns={EXPORT_COLUMNS[activeTab]}
            exportLabel="Xuất CSV"
            exportScopeLabel={`Xuất ${rowsByTab[activeTab].length} bản ghi trong tab hiện tại`}
            filename={`catalogue-cv-${activeTab}`}
            onRefresh={load}
            refreshing={loading}
            rows={rowsByTab[activeTab]}
          />
        </div>
        <Tabs activeKey={activeTab} onChange={(tab) => {
          const next = new URLSearchParams(searchParams)
          if (tab === 'templates') next.delete('tab')
          else next.set('tab', tab)
          setSearchParams(next)
        }} items={[
        { key: 'templates', label: 'Mẫu CV', children: <Table rowKey="public_id" loading={loading} dataSource={filtered.templates} columns={templateColumns} pagination={false} showSorterTooltip={{ target: 'sorter-icon' }} /> },
        { key: 'samples', label: 'Nội dung mẫu', children: <Table rowKey="public_id" loading={loading} dataSource={filtered.samples} columns={sampleColumns} pagination={false} showSorterTooltip={{ target: 'sorter-icon' }} /> },
        { key: 'blueprints', label: 'Blueprint', children: <Table rowKey="public_id" loading={loading} dataSource={filtered.blueprints} pagination={false} showSorterTooltip={{ target: 'sorter-icon' }} columns={[
          { title: 'Ngôn ngữ', dataIndex: 'locale', sorter: compareText('locale') }, { title: 'Cấp độ', dataIndex: 'experience_level', sorter: compareText('experience_level') },
          { title: 'Trạng thái', dataIndex: 'is_active', sorter: compareBoolean('is_active'), render: statusTag },
          { title: 'Thao tác', render: (_, row) => <Button icon={<CheckCircleOutlined />} size="small" disabled={row.is_active} onClick={() => act(() => activateAdminCvBlueprint(row.public_id), 'Đã kích hoạt blueprint.')}>Kích hoạt</Button> },
        ]} /> },
        { key: 'locales', label: 'Ngôn ngữ', children: <Table rowKey="code" loading={loading} dataSource={filtered.locales} pagination={false} showSorterTooltip={{ target: 'sorter-icon' }} columns={[
          { title: 'Mã', dataIndex: 'code', sorter: compareText('code') }, { title: 'Tên', dataIndex: 'label_vi', sorter: compareText('label_vi') }, { title: 'Đường dẫn', dataIndex: 'catalog_path', sorter: compareText('catalog_path') }, { title: 'Mặc định', dataIndex: 'is_default', sorter: compareBoolean('is_default'), render: statusTag }, { title: 'Trạng thái', dataIndex: 'is_active', sorter: compareBoolean('is_active'), render: statusTag },
        ]} /> },
        { key: 'taxonomy', label: 'Danh mục & màu', children: <div className="grid gap-5 xl:grid-cols-2"><Table rowKey="public_id" dataSource={filtered.categories} pagination={false} showSorterTooltip={{ target: 'sorter-icon' }} columns={[{ title: 'Danh mục', dataIndex: 'name', sorter: compareText('name') }, { title: 'Loại', dataIndex: 'category_type', sorter: compareText('category_type') }]} /><Table rowKey="public_id" dataSource={filtered.colors} pagination={false} showSorterTooltip={{ target: 'sorter-icon' }} columns={[{ title: 'Màu', dataIndex: 'name', sorter: compareText('name') }, { title: 'Mã HEX', dataIndex: 'hex_code', sorter: compareText('hex_code') }]} /></div> },
        { key: 'backgrounds', label: 'Hình nền', children: <div className="space-y-4"><Upload accept="image/jpeg,image/png,image/webp" showUploadList={false} beforeUpload={async (file) => { await act(() => createAdminCvBackground(file, file.name.replace(/\.[^.]+$/, '')), 'Đã thêm hình nền CV.'); return false }}><Button data-print-hide="true" icon={<UploadOutlined />} type="primary">Tải ảnh nền mới</Button></Upload><Table rowKey="public_id" loading={loading} dataSource={filtered.backgrounds} pagination={false} showSorterTooltip={{ target: 'sorter-icon' }} columns={[
          { title: 'Ảnh', render: (_, row) => <img src={row.url} alt={`Hình nền ${row.title}`} loading="lazy" className="h-24 w-20 rounded object-cover" /> },
          { title: 'Tên', dataIndex: 'title', sorter: compareText('title'), render: (value, row) => <Input defaultValue={value} onBlur={(event) => { const title = event.target.value.trim(); if (title !== value) act(() => updateAdminCvBackground(row.public_id, { title }), 'Đã đổi tên hình nền.') }} /> },
          { title: 'Kích thước', key: 'size', sorter: (left, right) => (left.width * left.height) - (right.width * right.height), render: (_, row) => `${row.width}×${row.height}` },
          { title: 'Đang dùng', dataIndex: 'is_active', sorter: compareBoolean('is_active'), render: (value, row) => <Switch checked={value} onChange={(is_active) => act(() => updateAdminCvBackground(row.public_id, { is_active }), 'Đã cập nhật trạng thái hình nền.')} /> },
          { title: 'Thao tác', render: (_, row) => <Button icon={<InboxOutlined />} danger size="small" disabled={!row.is_active} onClick={() => act(() => archiveAdminCvBackground(row.public_id), 'Đã ẩn hình nền khỏi catalogue.')}>Ẩn</Button> },
        ]} /></div> },
        ]} />
      </AdminPanel>
      <StructuredSampleEditor sample={editing} open={Boolean(editing)} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
    </div>
  )
}
