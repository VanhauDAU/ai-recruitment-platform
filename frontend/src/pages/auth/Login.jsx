import { Form, Input, Button, Alert } from 'antd'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const HOME_BY_ROLE = {
  candidate: '/candidate/dashboard',
  employer: '/employer/dashboard',
  admin: '/admin/dashboard',
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onFinish(values) {
    setError('')
    setLoading(true)
    try {
      const user = await login(values)
      navigate(HOME_BY_ROLE[user.role] || '/')
    } catch {
      setError('Email hoặc mật khẩu không đúng.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {error && <Alert type="error" message={error} showIcon className="mb-4" />}
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
          <Input autoComplete="email" />
        </Form.Item>
        <Form.Item name="password" label="Mật khẩu" rules={[{ required: true }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading}>
          Đăng nhập
        </Button>
      </Form>
      <p className="text-center mt-4 text-sm">
        Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
      </p>
    </>
  )
}
