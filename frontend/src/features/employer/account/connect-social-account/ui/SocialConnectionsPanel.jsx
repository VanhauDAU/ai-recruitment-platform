import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Avatar, Button, Empty, Modal, Radio, Skeleton, Tag } from 'antd'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  campaignKeys,
  ChannelIcon,
  disconnectSocialConnection,
  getPendingSocialAccounts,
  getSocialConnections,
  selectSocialAccount,
  startSocialConnect,
  useSocialNetworks,
} from '@/entities/campaign/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import './social-connections.css'

const CALLBACK_ERRORS = {
  denied: (network) => m.employer_account_social_error_denied({ network }),
  expired: () => m.employer_account_social_error_expired(),
  provider: (network) => m.employer_account_social_error_provider({ network }),
}
const STATUS_COLORS = { connected: 'green', expired: 'orange' }

function AccountPicker({ network, nonce, onDone }) {
  const queryClient = useQueryClient()
  const [accountId, setAccountId] = useState('')
  const accountsQuery = useQuery({
    queryKey: campaignKeys.pendingAccounts(network.key, nonce),
    queryFn: () => getPendingSocialAccounts(network.key, nonce),
    retry: false,
  })
  const mutation = useMutation({
    mutationFn: () => selectSocialAccount(network.key, nonce, accountId),
    onSuccess: (connection) => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.socialConnections })
      message.success(m.employer_account_social_page_connected({ network: network.label, name: connection.account_name }))
      onDone()
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_account_social_page_save_failed())),
  })
  const accounts = accountsQuery.data || []

  return (
    <Modal
      open
      title={m.employer_account_social_picker_title({ network: network.label })}
      okText={m.employer_account_social_picker_ok()}
      cancelText={m.employer_account_docs_cancel()}
      okButtonProps={{ disabled: !accountId }}
      confirmLoading={mutation.isPending}
      onCancel={onDone}
      onOk={() => mutation.mutate()}
    >
      {accountsQuery.isLoading && <Skeleton active paragraph={{ rows: 3 }} />}
      {accountsQuery.isError && <Alert type="error" showIcon title={getApiErrorMessage(accountsQuery.error, m.employer_account_social_picker_expired())} />}
      {accountsQuery.isSuccess && accounts.length === 0 && (
        <Empty description={m.employer_account_social_picker_empty({ network: network.label })} />
      )}
      <Radio.Group value={accountId} onChange={(event) => setAccountId(event.target.value)} className="sc-pages">
        {accounts.map((account) => (
          <Radio key={account.id} value={account.id}>
            <span className="sc-page">
              <Avatar src={account.picture_url || undefined} size="small">{account.name.slice(0, 1)}</Avatar>
              {account.name}
            </span>
          </Radio>
        ))}
      </Radio.Group>
    </Modal>
  )
}

// Một mạng: biểu tượng, các tài khoản đã kết nối và nút kết nối (OAuth của mạng đó).
function NetworkCard({ network, connections, connecting, onConnect, onDisconnect }) {
  return (
    <section className="sc-network" aria-labelledby={`sc-${network.key}`}>
      <header className="sc-network__head">
        <ChannelIcon kind={network.channel_kind} />
        <h3 id={`sc-${network.key}`}>{network.label}</h3>
        {network.simulated && <Tag>{m.employer_account_social_simulated({ network: network.platform })}</Tag>}
      </header>
      {connections.length === 0 ? (
        <p className="sc-network__empty">{m.employer_account_social_empty({ network: network.label })}</p>
      ) : (
        <ul className="sc-accounts">
          {connections.map((connection) => (
            <li key={connection.public_id} className="sc-account">
              <Avatar src={connection.account_picture_url || undefined}>{connection.account_name.slice(0, 1)}</Avatar>
              <span className="sc-account__info">
                <span className="sc-account__name" title={connection.account_name}>{connection.account_name}</span>
                <Tag color={STATUS_COLORS[connection.status]}>{connection.status_label}</Tag>
              </span>
              <Button size="small" type="text" danger onClick={() => onDisconnect(connection)}>{m.employer_account_social_disconnect()}</Button>
            </li>
          ))}
        </ul>
      )}
      <Button loading={connecting} onClick={() => onConnect(network.key)} className="sc-network__connect">
        {connections.length ? m.employer_account_social_connect_more() : m.employer_account_social_connect({ network: network.label })}
      </Button>
    </section>
  )
}

// Kết nối tài khoản mạng xã hội để kênh chiến dịch tự đăng bài.
export default function SocialConnectionsPanel() {
  const { modal } = App.useApp()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const networksQuery = useSocialNetworks()
  const connectionsQuery = useQuery({ queryKey: campaignKeys.socialConnections, queryFn: getSocialConnections })
  const connect = useMutation({
    mutationFn: startSocialConnect,
    onSuccess: (url) => window.location.assign(url),
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_account_social_connect_failed())),
  })
  const disconnect = useMutation({
    mutationFn: disconnectSocialConnection,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignKeys.socialConnections }),
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_account_social_disconnect_failed())),
  })
  const networks = networksQuery.data || []
  const connections = connectionsQuery.data || []
  const callbackNetwork = networks.find((network) => network.key === searchParams.get('network'))
  const nonce = searchParams.get('social_select')
  const callbackError = callbackNetwork && CALLBACK_ERRORS[searchParams.get('social_error')]?.(callbackNetwork.platform)
  const clearCallback = () => setSearchParams({}, { replace: true })
  const confirmDisconnect = (connection) => modal.confirm({
    title: m.employer_account_social_disconnect_title({ name: connection.account_name }),
    content: m.employer_account_social_disconnect_desc(),
    okText: m.employer_account_social_disconnect(),
    okButtonProps: { danger: true },
    cancelText: m.employer_account_docs_cancel(),
    onOk: () => disconnect.mutateAsync(connection.public_id),
  })

  return (
    <div className="sc-panel">
      <p className="sc-intro">{m.employer_account_social_intro()}</p>
      {callbackError && <Alert type="warning" showIcon closable title={callbackError} onClose={clearCallback} />}
      {networksQuery.isLoading || connectionsQuery.isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : (
        <div className="sc-networks">
          {networks.map((network) => (
            <NetworkCard
              key={network.key}
              network={network}
              connections={connections.filter((connection) => connection.network === network.key)}
              connecting={connect.isPending && connect.variables === network.key}
              onConnect={connect.mutate}
              onDisconnect={confirmDisconnect}
            />
          ))}
        </div>
      )}
      {nonce && callbackNetwork && <AccountPicker network={callbackNetwork} nonce={nonce} onDone={clearCallback} />}
    </div>
  )
}
