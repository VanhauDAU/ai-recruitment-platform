import { Button, Input, Modal, Space, Table, Tabs, Tag, Typography, message } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import {
  activateAdminCvBlueprint,
  archiveAdminCvSample,
  createAdminTemplateVersion,
  getAdminCvBlueprints,
  getAdminCvCategories,
  getAdminCvColors,
  getAdminCvSamples,
  getAdminCvTemplates,
  publishAdminCvSample,
  publishAdminTemplateVersion,
  regenerateAdminTemplateSnapshots,
  updateAdminCvSample,
} from '@/entities/cv-template'
import { getAdminLocales } from '@/entities/locale'

function statusTag(value) {
  const color = value === 'published' || value === true ? 'green' : value === 'draft' ? 'gold' : 'default'
  return <Tag color={color}>{String(value)}</Tag>
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
    <Modal title="Biên tập nội dung CV mẫu" open={open} onCancel={onClose} onOk={save} confirmLoading={saving} width={920}>
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
  const [data, setData] = useState({ templates: [], samples: [], blueprints: [], locales: [], categories: [], colors: [] })
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [templates, samples, blueprints, locales, categories, colors] = await Promise.all([
        getAdminCvTemplates(), getAdminCvSamples(), getAdminCvBlueprints(),
        getAdminLocales(), getAdminCvCategories(), getAdminCvColors(),
      ])
      setData({ templates, samples, blueprints, locales, categories, colors })
    } catch {
      message.error('Không thể tải catalogue CV quản trị.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  const act = async (operation, success) => {
    try {
      await operation()
      message.success(success)
      await load()
    } catch {
      message.error('Thao tác không thành công. Vui lòng kiểm tra trạng thái dữ liệu.')
    }
  }

  const templateColumns = [
    { title: 'Template', dataIndex: 'name' },
    { title: 'Lifecycle', dataIndex: 'lifecycle_status', render: statusTag },
    { title: 'Version hiện tại', dataIndex: 'current_published_version_id', render: (value) => value || '—' },
    {
      title: 'Thao tác', render: (_, row) => {
        const draft = row.versions?.find((version) => version.version_status === 'draft')
        return <Space wrap>
          <Button size="small" onClick={() => act(() => createAdminTemplateVersion(row.public_id), 'Đã tạo draft version mới.')}>Tạo version</Button>
          {draft && <Button size="small" type="primary" onClick={() => act(() => publishAdminTemplateVersion(row.public_id, draft.id), 'Đã publish version.')}>Publish draft</Button>}
          <Button size="small" onClick={() => act(() => regenerateAdminTemplateSnapshots(row.public_id), 'Đã xếp hàng sinh snapshot.')}>Sinh lại snapshot</Button>
        </Space>
      },
    },
  ]
  const sampleColumns = [
    { title: 'Nội dung', dataIndex: 'title' },
    { title: 'Locale', dataIndex: 'locale' },
    { title: 'Trạng thái', dataIndex: 'status', render: statusTag },
    { title: 'Thao tác', render: (_, row) => <Space>
      <Button size="small" onClick={() => setEditing(row)}>Sửa có cấu trúc</Button>
      {row.status === 'draft' && <Button size="small" type="primary" onClick={() => act(() => publishAdminCvSample(row.public_id), 'Đã publish nội dung mẫu.')}>Publish</Button>}
      {row.status !== 'archived' && <Button size="small" danger onClick={() => act(() => archiveAdminCvSample(row.public_id), 'Đã archive nội dung mẫu.')}>Archive</Button>}
    </Space> },
  ]

  return (
    <div>
      <Typography.Title level={2}>Catalogue CV</Typography.Title>
      <Typography.Paragraph type="secondary">Quản lý publishing, nội dung có cấu trúc và snapshot bằng cùng canonical pipeline với ứng viên.</Typography.Paragraph>
      <Tabs items={[
        { key: 'templates', label: 'Templates', children: <Table rowKey="public_id" loading={loading} dataSource={data.templates} columns={templateColumns} pagination={false} /> },
        { key: 'samples', label: 'Nội dung mẫu', children: <Table rowKey="public_id" loading={loading} dataSource={data.samples} columns={sampleColumns} pagination={false} /> },
        { key: 'blueprints', label: 'Blueprints', children: <Table rowKey="public_id" loading={loading} dataSource={data.blueprints} pagination={false} columns={[
          { title: 'Locale', dataIndex: 'locale' }, { title: 'Level', dataIndex: 'experience_level' },
          { title: 'Active', dataIndex: 'is_active', render: statusTag },
          { title: 'Thao tác', render: (_, row) => <Button size="small" disabled={row.is_active} onClick={() => act(() => activateAdminCvBlueprint(row.public_id), 'Đã kích hoạt blueprint.')}>Kích hoạt</Button> },
        ]} /> },
        { key: 'locales', label: 'Locales', children: <Table rowKey="code" loading={loading} dataSource={data.locales} pagination={false} columns={[
          { title: 'Code', dataIndex: 'code' }, { title: 'Tên', dataIndex: 'label_vi' }, { title: 'Path', dataIndex: 'catalog_path' }, { title: 'Default', dataIndex: 'is_default', render: statusTag }, { title: 'Active', dataIndex: 'is_active', render: statusTag },
        ]} /> },
        { key: 'taxonomy', label: 'Danh mục & màu', children: <Space align="start" className="w-full" size="large"><Table rowKey="public_id" dataSource={data.categories} pagination={false} columns={[{ title: 'Danh mục', dataIndex: 'name' }, { title: 'Loại', dataIndex: 'category_type' }]} /><Table rowKey="public_id" dataSource={data.colors} pagination={false} columns={[{ title: 'Màu', dataIndex: 'name' }, { title: 'Hex', dataIndex: 'hex_code' }]} /></Space> },
      ]} />
      <StructuredSampleEditor sample={editing} open={Boolean(editing)} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
    </div>
  )
}
