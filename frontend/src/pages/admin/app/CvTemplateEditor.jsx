import { AdminCvShell } from '@/widgets/admin-cv-nav'
import { AdminCvTemplateEditor } from '@/widgets/admin-cv-templates'

export default function AdminCvTemplateEditorPage() {
  return (
    <AdminCvShell compact>
      <AdminCvTemplateEditor />
    </AdminCvShell>
  )
}
