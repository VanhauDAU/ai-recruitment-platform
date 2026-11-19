import { CheckCircleFilled } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Form, Input, Radio, Rate } from 'antd'
import {
  applicationKeys,
  REVIEW_RECOMMENDATIONS,
  submitPublicApplicationReview,
} from '@/entities/application/application'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { formatDateTime } from '@/shared/lib/date-time'
import { message } from '@/shared/lib/toast'
import { m } from '@/shared/config/i18n'

/** The scorecard an invited reviewer fills in; re-submitting updates it. */
export default function ReviewScorecardForm({ token, review }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (values) => submitPublicApplicationReview(token, values),
    onSuccess: (saved) => {
      queryClient.setQueryData(applicationKeys.publicReview(token), (current) => (
        current ? { ...current, review: saved } : current
      ))
      message.success(m.employer_workspace_scorecard_sent())
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_workspace_scorecard_send_error())),
  })

  return (
    <Form
      layout="vertical"
      requiredMark={false}
      initialValues={{
        recommendation: review?.recommendation,
        rating: review?.rating || 0,
        strengths: review?.strengths || '',
        concerns: review?.concerns || '',
      }}
      onFinish={(values) => mutation.mutate({ ...values, rating: values.rating || null })}
    >
      {review && (
        <Alert
          showIcon
          type="success"
          icon={<CheckCircleFilled />}
          className="!mb-4"
          title={m.employer_workspace_scorecard_already_title()}
          description={m.employer_workspace_scorecard_already_description({ date: formatDateTime(review.updated_at) })}
        />
      )}
      <Form.Item name="recommendation" label={m.employer_workspace_scorecard_recommendation()} rules={[{ required: true, message: m.employer_workspace_scorecard_recommendation_required() }]}>
        <Radio.Group optionType="button" buttonStyle="solid" className="!flex !flex-wrap !gap-2">
          {REVIEW_RECOMMENDATIONS.map((item) => <Radio.Button key={item.value} value={item.value}>{item.label}</Radio.Button>)}
        </Radio.Group>
      </Form.Item>
      <Form.Item name="rating" label={m.employer_workspace_scorecard_fit()}>
        <Rate aria-label={m.employer_workspace_scorecard_fit()} />
      </Form.Item>
      <Form.Item name="strengths" label={m.employer_workspace_scorecard_strengths()}>
        <Input.TextArea rows={3} maxLength={2000} showCount placeholder={m.employer_workspace_scorecard_strengths_placeholder()} />
      </Form.Item>
      <Form.Item name="concerns" label={m.employer_workspace_scorecard_concerns()}>
        <Input.TextArea rows={3} maxLength={2000} showCount placeholder={m.employer_workspace_scorecard_concerns_placeholder()} />
      </Form.Item>
      <Button type="primary" htmlType="submit" block loading={mutation.isPending}>
        {review ? m.employer_workspace_scorecard_update() : m.employer_workspace_scorecard_submit()}
      </Button>
    </Form>
  )
}
