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
} from '@/entities/campaign/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import './social-connections.css'
import { m } from '@/shared/config/i18n'

const CALLBACK_ERRORS = {
  denied: m.employer_account_social_error_denied(),
  expired: m.employer_account_social_error_expired(),
  provider: m.employer_account_social_error_provider(),
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
      message.success(m.employer_account_social_page_connected({ name: connection.page_name }))
      onDone()
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_account_social_page_save_failed())),
  })
  const pages = pagesQuery.data || []

  return (
    <Modal
      open
      title={m.employer_account_social_picker_title()}
      okText={m.employer_account_social_picker_ok()}
      cancelText={m.employer_account_docs_cancel()}
      okButtonProps={{ disabled: !pageId }}
      confirmLoading={mutation.isPending}
      onCancel={onDone}
      onOk={() => mutation.mutate()}
    >
      {pagesQuery.isLoading && <Skeleton active paragraph={{ rows: 3 }} />}
      {pagesQuery.isError && <Alert type="error" showIcon title={getApiErrorMessage(pagesQuery.error, m.employer_account_social_picker_expired())} />}
      {pagesQuery.isSuccess && pages.length === 0 && (
        <Empty description={m.employer_account_social_picker_empty()} />
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
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_account_social_connect_failed())),
  })
  const disconnect = useMutation({
    mutationFn: disconnectSocialConnection,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignKeys.socialConnections }),
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_account_social_disconnect_failed())),
  })
  const clearCallback = () => setSearchParams({}, { replace: true })
  const connections = connectionsQuery.data || []

  return (
    <div className="sc-panel">
      <p className="sc-intro">
        {m.employer_account_social_intro()}
      </p>
      {callbackError && <Alert type="warning" showIcon closable title={callbackError} onClose={clearCallback} />}
      <List
        loading={connectionsQuery.isLoading}
        locale={{ emptyText: <Empty description={m.employer_account_social_empty()} /> }}
        dataSource={connections}
        renderItem={(connection) => (
          <List.Item
            actions={[
              <Button
                key="disconnect"
                size="small"
                danger
                onClick={() => modal.confirm({
                  title: m.employer_account_social_disconnect_title({ name: connection.page_name }),
                  content: m.employer_account_social_disconnect_desc(),
                  okText: m.employer_account_social_disconnect(),
                  okButtonProps: { danger: true },
                  cancelText: m.employer_account_docs_cancel(),
                  onOk: () => disconnect.mutateAsync(connection.public_id),
                })}
              >
                {m.employer_account_social_disconnect()}
              </Button>,
            ]}
          >
            <List.Item.Meta
              avatar={<Avatar src={connection.page_picture_url || undefined} icon={<FacebookFilled />} />}
              title={connection.page_name}
              description={(
                <span className="sc-tags">
                  <Tag color={STATUS_COLORS[connection.status]}>{connection.status_label}</Tag>
                  {connection.simulated && <Tag>{m.employer_account_social_simulated()}</Tag>}
                </span>
              )}
            />
          </List.Item>
        )}
      />
      <Button type="primary" icon={<FacebookFilled />} loading={connect.isPending} onClick={() => connect.mutate()}>
        {connections.length ? m.employer_account_social_connect_more() : m.employer_account_social_connect()}
      </Button>
      {nonce && <PagePicker nonce={nonce} onDone={clearCallback} />}
    </div>
  )
}
