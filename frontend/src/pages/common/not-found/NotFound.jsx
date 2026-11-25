import { Button, Result } from 'antd'
import { Link } from 'react-router'
import { m } from '@/shared/config/i18n'

export default function NotFound() {
  return (
    <Result
      status="404"
      title="404"
      subTitle={m.common_not_found_description()}
      extra={<Link to="/"><Button type="primary">{m.common_not_found_home()}</Button></Link>}
    />
  )
}
