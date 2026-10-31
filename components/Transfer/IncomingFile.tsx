import { Button } from '~/components/ui/Button'
import { formatBytes } from '~/helpers/transferProgress'
import { useTranslation } from '~/context/TranslationContext'
import { FileDescription } from '~/services/transfer/FileExchange'

interface Props {
  file: FileDescription
  tooLarge: boolean
  onAccept: () => void
}

export function IncomingFile({ file, tooLarge, onAccept }: Props) {
  const { t } = useTranslation()

  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-muted">{ t('transfer.incoming') }</p>
      <p className="text-sm break-all text-foreground">
        { file.name } <span className="text-muted">({ formatBytes(file.size) })</span>
      </p>
      { tooLarge && <p role="alert" className="text-sm text-foreground">{ t('transfer.tooLarge') }</p> }
      <Button onClick={ onAccept }>{ t('transfer.accept') }</Button>
    </section>
  )
}
