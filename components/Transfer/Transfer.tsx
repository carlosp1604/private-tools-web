import { useTransfer } from '~/hooks/useTransfer'
import { Button } from '~/components/ui/Button'
import { ToolPage } from '~/components/Layout/ToolPage'
import { TransferStart } from '~/components/Transfer/TransferStart'
import { useTranslation } from '~/context/TranslationContext'
import { TransferInvitation } from '~/components/Transfer/TransferInvitation'
import { TransferVerification } from '~/components/Transfer/TransferVerification'

const END_MESSAGES = {
  room_not_found: 'transfer.end.notFound',
  room_closed: 'transfer.end.closed',
  room_expired: 'transfer.end.expired',
  failed: 'transfer.end.failed',
  unreachable: 'transfer.end.unreachable',
  compromised: 'transfer.end.compromised',
} as const

const STATUS_MESSAGES = {
  waiting: 'transfer.status.waiting',
  connecting: 'transfer.status.connecting',
  verifying: 'transfer.status.connecting',
  connected: 'transfer.status.connecting',
} as const

interface Props {
  initialCode?: string
  expectedCommitment?: string
}

export function Transfer({ initialCode, expectedCommitment }: Props) {
  const { t } = useTranslation()
  const { role, status, code, commitment, names, endReason, send, receive, leave } = useTransfer(initialCode, expectedCommitment)

  return (
    <ToolPage title={ t('landing.files.title') } description={ t('transfer.description') }>
      { endReason && (
        <p role="alert" className="rounded-lg bg-border px-3 py-2 text-sm text-foreground">{ t(END_MESSAGES[endReason]) }</p>
      ) }

      { !role && (
        <TransferStart
          onSend={ () => void send() }
          onReceive={ (roomCode) => void receive(roomCode, null) }
        />
      ) }

      { role && status && (
        <>
          { role === 'sender' && status === 'waiting' && (
            <TransferInvitation code={ code } link={ `${location.origin}/f/${code}#${commitment}` } />
          ) }

          { names
            ? <TransferVerification role={ role } names={ names } />
            : (
              status !== 'unreachable' && status !== 'compromised'
              && <p role="status" className="text-center text-sm text-foreground">{ t(STATUS_MESSAGES[status]) }</p>
            ) }

          <Button variant="secondary" onClick={ leave }>{ t('chat.leave') }</Button>
        </>
      ) }
    </ToolPage>
  )
}
