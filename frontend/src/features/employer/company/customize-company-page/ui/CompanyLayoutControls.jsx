import { Alert, Button } from 'antd'
import { m } from '@/shared/config/i18n'
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
        <h2 id="company-layout-sections" className="company-layout-heading">{m.employer_company_layout_sections()}</h2>
        <p className="company-layout-hint">
          {m.employer_company_layout_sections_hint()}
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
        <h2 id="company-layout-accent" className="company-layout-heading">{m.employer_company_layout_accent()}</h2>
        <AccentPalettePicker
          accents={registry.accents}
          value={draft.accent}
          disabled={disabled}
          onChange={(accent) => controller.update({ accent })}
        />
      </section>

      <section aria-labelledby="company-layout-pinned">
        <h2 id="company-layout-pinned" className="company-layout-heading">{m.employer_company_layout_pinned()}</h2>
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
              {dirty ? m.employer_company_layout_dirty() : m.employer_company_layout_in_sync()}
            </span>
            <Button disabled={!dirty || saving} onClick={controller.reset}>{m.employer_company_layout_undo()}</Button>
            <Button type="primary" loading={saving} disabled={!dirty} onClick={controller.save}>{m.employer_company_save_changes()}</Button>
          </>
        ) : (
          <p className="company-layout-hint">
            {readOnlyReason || m.employer_company_layout_read_only()}
          </p>
        )}
      </div>
    </div>
  )
}
