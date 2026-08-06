import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  Alert,
  Button,
  Form,
  Space,
  Steps,
} from 'antd'
import { useMemo, useState } from 'react'
import {
  ANNOUNCEMENT_DISMISS_MODES,
  ANNOUNCEMENT_KINDS,
} from '@/entities/announcement'
import {
  announcementEditorIssues,
  announcementEditorValues,
  announcementRevisionPayload,
} from '../model/editor-model'
import {
  ContentStep,
  PreviewStep,
  ScheduleStep,
  TargetStep,
  TypeStep,
} from './AnnouncementEditorSteps'

const STEPS = [
  { title: 'Nội dung' },
  { title: 'Loại & CTA' },
  { title: 'Đối tượng' },
  { title: 'Lịch & ưu tiên' },
  { title: 'Xem trước' },
]

const STEP_FIELDS = [
  ['internal_name', 'message_vi', 'message_en', 'badge_vi', 'badge_en'],
  ['kind', 'icon', 'cta_mode', 'cta_label_vi', 'cta_label_en', 'cta_url', 'dismiss_mode'],
  ['surfaces', 'auth_audiences', 'roles', 'include_path_prefixes', 'exclude_path_prefixes'],
  ['starts_at', 'ends_at', 'priority', 'animation', 'display_seconds'],
  [],
]

function dateInitial(value) {
  return value ? dayjs(value) : null
}

export default function AnnouncementEditor({
  announcements = [],
  detail = null,
  pending = false,
  onCancel,
  onSubmit,
}) {
  const [form] = Form.useForm()
  const [step, setStep] = useState(0)
  const [issues, setIssues] = useState([])
  const baseValues = useMemo(() => announcementEditorValues(detail), [detail])
  const initialValues = useMemo(() => ({
    ...baseValues,
    starts_at: dateInitial(baseValues.starts_at),
    ends_at: dateInitial(baseValues.ends_at),
  }), [baseValues])
  const dismissMode = Form.useWatch('dismiss_mode', form)
  const kind = Form.useWatch('kind', form)
  const themeMode = Form.useWatch('theme_mode', form) || initialValues.theme_mode
  const priority = Form.useWatch('priority', form)
  const ctaMode = Form.useWatch('cta_mode', form) || initialValues.cta_mode
  const surfaces = Form.useWatch('surfaces', form) || initialValues.surfaces
  const audiences = Form.useWatch('auth_audiences', form) || initialValues.auth_audiences

  const next = async () => {
    await form.validateFields(STEP_FIELDS[step])
    setStep((current) => Math.min(current + 1, STEPS.length - 1))
  }

  const submit = async () => {
    await form.validateFields()
    const values = form.getFieldsValue(true)
    const nextIssues = announcementEditorIssues(values)
    setIssues(nextIssues)
    if (nextIssues.length) return
    await onSubmit({
      internal_name: values.internal_name.trim(),
      revision: announcementRevisionPayload(values),
    })
  }

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues}
      disabled={pending}
      onValuesChange={(changed) => {
        setIssues([])
        if (
          changed.kind === ANNOUNCEMENT_KINDS.CRITICAL
          && form.getFieldValue('dismiss_mode') !== ANNOUNCEMENT_DISMISS_MODES.LOCKED
        ) {
          form.setFieldValue('dismiss_mode', ANNOUNCEMENT_DISMISS_MODES.LOCKED)
        }
      }}
    >
      <Steps
        className="announcement-editor__steps"
        current={step}
        items={STEPS}
        responsive
      />

      <div className="announcement-editor__body">
        {step === 0 && (
          <ContentStep detail={detail} />
        )}

        {step === 1 && (
          <TypeStep
            audiences={audiences}
            ctaMode={ctaMode}
            dismissMode={dismissMode}
            form={form}
            kind={kind}
            surfaces={surfaces}
            themeMode={themeMode}
          />
        )}

        {step === 2 && <TargetStep surfaces={surfaces} />}

        {step === 3 && (
          <ScheduleStep form={form} priority={priority} />
        )}

        {step === 4 && <PreviewStep form={form} announcements={announcements} />}

        {issues.length > 0 && (
          <Alert
            className="mt-5"
            type="error"
            showIcon
            title="Cần hoàn thiện cấu hình"
            description={(
              <ul className="m-0 pl-5">
                {issues.map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
            )}
          />
        )}
      </div>

      <div className="announcement-editor__footer">
        <Button onClick={onCancel}>Hủy</Button>
        <Space wrap>
          {step > 0 && (
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => setStep((current) => current - 1)}
            >
              Quay lại
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="primary" icon={<ArrowRightOutlined />} iconPlacement="end" onClick={next}>
              Tiếp tục
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<CheckOutlined />}
              loading={pending}
              onClick={submit}
            >
              {detail ? 'Lưu revision mới' : 'Tạo bản nháp'}
            </Button>
          )}
        </Space>
      </div>
    </Form>
  )
}
