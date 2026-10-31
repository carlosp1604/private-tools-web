import { useTransfer } from '~/hooks/useTransfer'
import { Button } from '~/components/ui/Button'
import { ToolPage } from '~/components/Layout/ToolPage'
import { IncomingFile } from '~/components/Transfer/IncomingFile'
import { OutgoingFile } from '~/components/Transfer/OutgoingFile'
import { TransferStart } from '~/components/Transfer/TransferStart'
import { TransferProgressBar } from '~/components/Transfer/TransferProgressBar'
import { useTranslation } from '~/context/TranslationContext'
import { TransferInvitation } from '~/components/Transfer/TransferInvitation'
import { TransferVerification } from '~/components/Transfer/TransferVerification'

const END_MESSAGES = {
  room_not_found: 'transfer.end.notFound',
  room_closed: 'transfer.end.closed',
  room_expired: 'transfer.end.expired',
  failed: 'transfer.end.failed',
  completed: 'transfer.end.completed',
  unreachable: 'transfer.end.unreachable',
  compromised: 'transfer.end.compromised',
} as const

const EXCHANGE_MESSAGES = {
  offered: 'transfer.exchange.offered',
  transferring: 'transfer.exchange.transferring',
  verifying: 'transfer.exchange.verifying',
  completed: 'transfer.exchange.completed',
  corrupted: 'transfer.exchange.corrupted',
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
  const {
    role,
    status,
    code,
    commitment,
    names,
    endReason,
    exchangeStatus,
    incomingFile,
    outgoingFile,
    progress,
    fileTooLarge,
    send,
    receive,
    leave,
    selectFile,
    confirmSend,
    acceptFile,
  } = useTransfer(initialCode, expectedCommitment)

  const totalBytes = incomingFile?.size ?? outgoingFile?.size ?? 0
  const inProgress = exchangeStatus === 'transferring' || exchangeStatus === 'verifying'
  const waitingToSend = exchangeStatus === 'idle' && role === 'sender'
  const waitingToAccept = exchangeStatus === 'idle' && role === 'receiver' && incomingFile !== null

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

          { waitingToSend && (
            <OutgoingFile file={ outgoingFile } canConfirm={ names !== null } onSelect={ selectFile } onConfirm={ confirmSend } />
          ) }

          { waitingToAccept && <IncomingFile file={ incomingFile } tooLarge={ fileTooLarge } onAccept={ () => void acceptFile() } /> }

          { exchangeStatus !== 'idle' && exchangeStatus !== 'failed' && (
            <p role="status" className="text-sm text-foreground">{ t(EXCHANGE_MESSAGES[exchangeStatus]) }</p>
          ) }

          { inProgress && <TransferProgressBar progress={ progress } totalBytes={ totalBytes } /> }

          { inProgress && <p className="text-xs leading-5 text-muted">{ t('transfer.keepOpen') }</p> }

          <Button variant="secondary" onClick={ leave }>{ t('chat.leave') }</Button>
        </>
      ) }
    </ToolPage>
  )
}
