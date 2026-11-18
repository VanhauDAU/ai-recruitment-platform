import { Alert, Button } from 'antd'
import AccentPalettePicker from './AccentPalettePicker'
import PinnedJobsPicker from './PinnedJobsPicker'
import SectionOrderList from './SectionOrderList'
import './customize-company-page.css'

/**
 * Tab "Bố cục" của workspace trang công ty. `controller` là kết quả của
 * `useCompanyLayoutDraft(page)` do nơi dùng giữ để chia sẻ bản nháp với bản xem
 * trước. Không có quyền sửa thì mọi điều khiển bị khoá và `readOnlyReason`
 * thay cho thanh lưu.
 */
export default function CompanyLayoutControls({ page, controller, readOnlyReason }) {
  const { registry, content, permissions } = page
  const { draft, dirty, saving, notice } = controller
  const canEdit = Boolean(permissions.can_edit_layout)
  const disabled = !canEdit || saving
  const contentKeys = new Set(
    [...(content.sections || []), ...(content.sidebar || [])].map((section) => section.key),
  )

  return (
    <div className="company-layout-controls">
      {notice && (
        <Alert showIcon type={notice.type} title={notice.text} closable={{ onClose: controller.dismissNotice }} />
      )}

      <section aria-labelledby="company-layout-sections">
        <h2 id="company-layout-sections" className="company-layout-heading">Khối nội dung</h2>
        <p className="company-layout-hint">
          Kéo thả hoặc dùng nút mũi tên để sắp xếp cột chính; tắt công tắc để ẩn một khối khỏi trang công khai.
        </p>
        <SectionOrderList
          sections={registry.sections}
          order={draft.section_order}
          hidden={draft.hidden_sections}
          contentKeys={contentKeys}
          disabled={disabled}
          onChange={controller.update}
        />
      </section>

      <section aria-labelledby="company-layout-accent">
        <h2 id="company-layout-accent" className="company-layout-heading">Màu nhấn</h2>
        <AccentPalettePicker
          accents={registry.accents}
          value={draft.accent}
          disabled={disabled}
          onChange={(accent) => controller.update({ accent })}
        />
      </section>

      <section aria-labelledby="company-layout-pinned">
        <h2 id="company-layout-pinned" className="company-layout-heading">Tin tuyển dụng nổi bật</h2>
        <PinnedJobsPicker
          jobs={controller.pinnedJobs}
          max={registry.limits?.pinned_jobs ?? 0}
          disabled={disabled}
          onChange={(ids) => controller.update({ pinned_job_public_ids: ids })}
          onPick={controller.pinJob}
        />
      </section>

      <div className="company-layout-savebar">
        {canEdit ? (
          <>
            <span className="company-layout-hint" role="status">
              {dirty ? 'Có thay đổi chưa lưu.' : 'Bố cục đang khớp với trang công khai.'}
            </span>
            <Button disabled={!dirty || saving} onClick={controller.reset}>Hoàn tác</Button>
            <Button type="primary" loading={saving} disabled={!dirty} onClick={controller.save}>Lưu thay đổi</Button>
          </>
        ) : (
          <p className="company-layout-hint">
            {readOnlyReason || 'Bạn chỉ có quyền xem bố cục trang công ty.'}
          </p>
        )}
      </div>
    </div>
  )
}
