import {
  DownloadOutlined,
  PrinterOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { Button, Space, Tooltip, Upload } from 'antd'
import { downloadCsv } from '@/shared/lib/admin-csv'

export default function AdminDataActions({
  rows = [],
  columns = [],
  filename = 'du-lieu-quan-tri',
  exportLabel = 'Xuất CSV',
  exportScopeLabel = 'Xuất dữ liệu của trang hiện tại',
  onExport,
  exporting = false,
  exportDisabled = false,
  exportDisabledReason = 'Không có dữ liệu để xuất',
  onRefresh,
  refreshing = false,
  onImport,
  importAccept = '.csv',
  importLabel = 'Nhập file',
  allowExport = true,
  allowPrint = true,
  compact = false,
  // Icon buttons only; each keeps its tooltip and accessible name.
  iconOnly = false,
}) {
  const buttonProps = compact ? { size: 'small' } : {}
  const text = (value) => (iconOnly ? null : value)
  const canExport = !exportDisabled && (
    Boolean(onExport) || (rows.length > 0 && columns.length > 0)
  )

  return (
    <Space className="admin-data-actions" wrap data-print-hide="true">
      {onRefresh && (
        <Tooltip title="Tải lại dữ liệu mới nhất">
          <Button
            {...buttonProps}
            aria-label="Tải lại dữ liệu"
            icon={<ReloadOutlined spin={refreshing} />}
            loading={refreshing}
            onClick={onRefresh}
          >
            {text('Làm mới')}
          </Button>
        </Tooltip>
      )}
      {onImport && (
        <Upload
          accept={importAccept}
          beforeUpload={(file) => {
            onImport(file)
            return false
          }}
          maxCount={1}
          showUploadList={false}
        >
          <Button {...buttonProps} aria-label={importLabel} icon={<UploadOutlined />}>
            {text(importLabel)}
          </Button>
        </Upload>
      )}
      {allowExport && (
        <Tooltip title={canExport ? exportScopeLabel : exportDisabledReason}>
          <span>
            <Button
              {...buttonProps}
              aria-label={exportScopeLabel}
              disabled={!canExport}
              icon={<DownloadOutlined />}
              loading={exporting}
              onClick={() => {
                if (onExport) {
                  onExport()
                  return
                }
                downloadCsv({ rows, columns, filename })
              }}
            >
              {text(exportLabel)}
            </Button>
          </span>
        </Tooltip>
      )}
      {allowPrint && (
        <Tooltip title="In màn hình hiện tại hoặc lưu thành PDF">
          <Button
            {...buttonProps}
            aria-label="In màn hình hiện tại"
            icon={<PrinterOutlined />}
            onClick={() => window.print()}
          >
            {text('In')}
          </Button>
        </Tooltip>
      )}
    </Space>
  )
}
