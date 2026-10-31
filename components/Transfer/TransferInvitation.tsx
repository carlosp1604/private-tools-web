import { Button } from '~/components/ui/Button'
import { RoomQrCode } from '~/components/Transfer/RoomQrCode'
import { useTranslation } from '~/context/TranslationContext'
import { useCopyToClipboard } from '~/hooks/useCopyToClipboard'

const CODE_GROUP = 4

interface Props {
  code: string
  link: string
}

export function TransferInvitation({ code, link }: Props) {
  const { t } = useTranslation()
  const codeCopy = useCopyToClipboard()
  const linkCopy = useCopyToClipboard()

  const readableCode = `${code.slice(0, CODE_GROUP)}-${code.slice(CODE_GROUP)}`

  return (
    <section className="flex flex-col items-center gap-5">
      <RoomQrCode value={ link } label={ t('transfer.qr') } />

      <code className="font-mono text-2xl tracking-wider text-foreground">{ readableCode }</code>

      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="secondary" onClick={ () => void codeCopy.copy(readableCode) }>
          { t(codeCopy.copied ? 'common.copied' : 'transfer.copyCode') }
        </Button>
        <Button variant="secondary" onClick={ () => void linkCopy.copy(link) }>
          { t(linkCopy.copied ? 'common.copied' : 'transfer.copyLink') }
        </Button>
      </div>
    </section>
  )
}
