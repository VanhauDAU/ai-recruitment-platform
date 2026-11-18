import { FacebookFilled } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Avatar, Button, Empty, List, Modal, Radio, Skeleton, Tag } from 'antd'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  campaignKeys,
  disconnectSocialConnection,
  getPendingFacebookPages,
  getSocialConnections,
  selectFacebookPage,
  startFacebookConnect,
} from '@/entities/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import './social-connections.css'

const CALLBACK_ERRORS = {
  denied: 'Bạn chưa cấp quyền cho ProCV trên Facebook nên chưa kết nối được.',
  expired: 'Phiên kết nối đã hết hạn hoặc không hợp lệ. Hãy bấm kết nối lại.',
  provider: 'Facebook chưa trả lời được. Thử lại sau ít phút.',
}
const STATUS_COLORS = { connected: 'green', expired: 'orange' }

function PagePicker({ nonce, onDone }) {
  const queryClient = useQueryClient()
  const [pageId, setPageId] = useState('')
  const pagesQuery = useQuery({
    queryKey: campaignKeys.pendingPages(nonce),
    queryFn: () => getPendingFacebookPages(nonce),
    retry: false,
  })
  const mutation = useMutation({
    mutationFn: () => selectFacebookPage(nonce, pageId),
    onSuccess: (connection) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.socialConnections })
      message.success(`Đã kết nối Fanpage "${connection.page_name}".`)
      onDone()
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể lưu Fanpage.')),
  })
  const pages = pagesQuery.data || []

  return (
    <Modal
      open
      title="Chọn Fanpage để đăng bài tuyển dụng"
      okText="Kết nối Fanpage"
      cancelText="Hủy"
      okButtonProps={{ disabled: !pageId }}
      confirmLoading={mutation.isPending}
      onCancel={onDone}
      onOk={() => mutation.mutate()}
    >
      {pagesQuery.isLoading && <Skeleton active paragraph={{ rows: 3 }} />}
      {pagesQuery.isError && <Alert type="error" showIcon title={getApiErrorMessage(pagesQuery.error, 'Phiên chọn Fanpage đã hết hạn.')} />}
      {pagesQuery.isSuccess && pages.length === 0 && (
        <Empty description="Tài khoản Facebook này chưa quản lý Fanpage nào, hoặc bạn chưa chọn Fanpage khi cấp quyền." />
      )}
      <Radio.Group value={pageId} onChange={(event) => setPageId(event.target.value)} className="sc-pages">
        {pages.map((page) => (
          <Radio key={page.id} value={page.id}>
            <span className="sc-page">
              <Avatar src={page.picture_url || undefined} icon={<FacebookFilled />} size="small" />
              {page.name}
            </span>
          </Radio>
        ))}
      </Radio.Group>
    </Modal>
  )
}

// Kết nối Fanpage Facebook để chiến dịch đăng bài tự động (OAuth của Facebook).
export default function SocialConnectionsPanel() {
  const { modal } = App.useApp()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const nonce = searchParams.get('fb_select')
  const callbackError = CALLBACK_ERRORS[searchParams.get('fb_error')]
  const connectionsQuery = useQuery({ queryKey: campaignKeys.socialConnections, queryFn: getSocialConnections })
  const connect = useMutation({
    mutationFn: startFacebookConnect,
    onSuccess: (url) => window.location.assign(url),
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể bắt đầu kết nối Facebook.')),
  })
  const disconnect = useMutation({
    mutationFn: disconnectSocialConnection,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignKeys.socialConnections }),
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể ngắt kết nối.')),
  })
  const clearCallback = () => setSearchParams({}, { replace: true })
  const connections = connectionsQuery.data || []

  return (
    <div className="sc-panel">
      <p className="sc-intro">
        Kết nối Fanpage của công ty để kênh "Fanpage Facebook" trong chiến dịch tự đăng bài đúng giờ hẹn.
        Bài được gỡ khỏi Fanpage khi chiến dịch hoàn tất hoặc bị hủy. ProCV chỉ lưu quyền đăng của Fanpage
        bạn chọn, đã mã hóa.
      </p>
      {callbackError && <Alert type="warning" showIcon closable title={callbackError} onClose={clearCallback} />}
      <List
        loading={connectionsQuery.isLoading}
        locale={{ emptyText: <Empty description="Chưa kết nối Fanpage nào" /> }}
        dataSource={connections}
        renderItem={(connection) => (
          <List.Item
            actions={[
              <Button
                key="disconnect"
                size="small"
                danger
                onClick={() => modal.confirm({
                  title: `Ngắt kết nối "${connection.page_name}"?`,
                  content: 'Các bài đang hẹn giờ trên Fanpage này sẽ bị hủy. Bài đã đăng vẫn giữ trên Fanpage.',
                  okText: 'Ngắt kết nối',
                  okButtonProps: { danger: true },
                  cancelText: 'Hủy',
                  onOk: () => disconnect.mutateAsync(connection.public_id),
                })}
              >
                Ngắt kết nối
              </Button>,
            ]}
          >
            <List.Item.Meta
              avatar={<Avatar src={connection.page_picture_url || undefined} icon={<FacebookFilled />} />}
              title={connection.page_name}
              description={(
                <span className="sc-tags">
                  <Tag color={STATUS_COLORS[connection.status]}>{connection.status_label}</Tag>
                  {connection.simulated && <Tag>Chế độ giả lập, không đăng lên Facebook thật</Tag>}
                </span>
              )}
            />
          </List.Item>
        )}
      />
      <Button type="primary" icon={<FacebookFilled />} loading={connect.isPending} onClick={() => connect.mutate()}>
        {connections.length ? 'Kết nối thêm Fanpage' : 'Kết nối Fanpage Facebook'}
      </Button>
      {nonce && <PagePicker nonce={nonce} onDone={clearCallback} />}
    </div>
  )
}
