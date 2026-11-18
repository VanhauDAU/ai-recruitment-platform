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

/** The scorecard an invited reviewer fills in; re-submitting updates it. */
export default function ReviewScorecardForm({ token, review }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (values) => submitPublicApplicationReview(token, values),
    onSuccess: (saved) => {
      queryClient.setQueryData(applicationKeys.publicReview(token), (current) => (
        current ? { ...current, review: saved } : current
      ))
      message.success('Đã gửi đánh giá. Cảm ơn bạn!')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không gửi được đánh giá.')),
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
          title="Bạn đã gửi đánh giá"
          description={`Cập nhật lần cuối ${formatDateTime(review.updated_at)}. Bạn vẫn có thể sửa cho tới khi link hết hạn.`}
        />
      )}
      <Form.Item name="recommendation" label="Đề xuất của bạn" rules={[{ required: true, message: 'Chọn một đề xuất.' }]}>
        <Radio.Group optionType="button" buttonStyle="solid" className="!flex !flex-wrap !gap-2">
          {REVIEW_RECOMMENDATIONS.map((item) => <Radio.Button key={item.value} value={item.value}>{item.label}</Radio.Button>)}
        </Radio.Group>
      </Form.Item>
      <Form.Item name="rating" label="Mức độ phù hợp với vị trí">
        <Rate aria-label="Mức độ phù hợp với vị trí" />
      </Form.Item>
      <Form.Item name="strengths" label="Điểm mạnh">
        <Input.TextArea rows={3} maxLength={2000} showCount placeholder="Kinh nghiệm, kỹ năng nổi bật..." />
      </Form.Item>
      <Form.Item name="concerns" label="Điều còn băn khoăn">
        <Input.TextArea rows={3} maxLength={2000} showCount placeholder="Điều cần làm rõ khi phỏng vấn..." />
      </Form.Item>
      <Button type="primary" htmlType="submit" block loading={mutation.isPending}>
        {review ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}
      </Button>
    </Form>
  )
}
