import { interpolate } from '~/helpers/interpolate'
import { useTranslation } from '~/context/TranslationContext'
import { TransferRole } from '~/services/transfer/TransferConnection'
import { VerificationNames } from '~/crypto/transferVerification'

interface Props {
  role: TransferRole
  names: VerificationNames
}

export function TransferVerification({ role, names }: Props) {
  const { t } = useTranslation()
  const ownName = role === 'sender' ? names.sender : names.receiver
  const peerName = role === 'sender' ? names.receiver : names.sender

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
      <p className="flex items-center gap-2 text-sm text-foreground">
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-online" />
        { interpolate(t('transfer.connectedWith'), { name: peerName }) }
      </p>
      <p className="text-sm text-muted">{ interpolate(t('chat.youAre'), { name: ownName }) }</p>
      <p className="text-xs leading-5 text-muted">{ t('transfer.verify') }</p>
    </section>
  )
}
