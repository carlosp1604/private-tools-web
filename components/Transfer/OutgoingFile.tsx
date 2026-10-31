import { ChangeEvent } from 'react'
import { Button } from '~/components/ui/Button'
import { formatBytes } from '~/helpers/transferProgress'
import { useTranslation } from '~/context/TranslationContext'

interface Props {
  file: File | null
  canConfirm: boolean
  onSelect: (file: File) => void
  onConfirm: () => void
}

export function OutgoingFile({ file, canConfirm, onSelect, onConfirm }: Props) {
  const { t } = useTranslation()

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0]

    if (selected) {
      onSelect(selected)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <label
        className="cursor-pointer rounded-xl border border-border px-4 py-2.5 text-center text-sm font-medium hover:bg-surface-hover"
      >
        { t('transfer.selectFile') }
        <input type="file" onChange={ handleChange } className="sr-only" aria-label={ t('transfer.selectFile') } />
      </label>

      { file && (
        <p className="text-sm break-all text-foreground">
          { file.name } <span className="text-muted">({ formatBytes(file.size) })</span>
        </p>
      ) }

      <Button disabled={ !canConfirm || !file } onClick={ onConfirm }>{ t('transfer.confirm') }</Button>
    </section>
  )
}
