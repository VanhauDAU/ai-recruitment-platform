import { Form, Input, Button, Radio, Alert } from 'antd'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../../api/authService'

export default function Register() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onFinish(values) {
    setError('')
    setLoading(true)
    try {
      await register(values)
      navigate('/login')
    } catch (err) {
      const data = err.response?.data
      setError(data ? Object.values(data).flat().join(' ') : 'Đăng ký thất bại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {error && <Alert type="error" message={error} showIcon className="mb-4" />}
      <Form layout="vertical" onFinish={onFinish} initialValues={{ role: 'candidate' }}>
        <Form.Item name="full_name" label="Họ tên">
          <Input />
        </Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
          <Input autoComplete="email" />
        </Form.Item>
        <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, min: 8 }]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item name="role" label="Bạn là">
          <Radio.Group
            options={[
              { label: 'Ứng viên', value: 'candidate' },
              { label: 'Nhà tuyển dụng', value: 'employer' },
            ]}
          />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading}>
          Đăng ký
        </Button>
      </Form>
      <p className="text-center mt-4 text-sm">
        Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
      </p>
    </>
  )
}
