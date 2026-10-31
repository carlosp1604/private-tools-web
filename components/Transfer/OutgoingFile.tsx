import { ChangeEvent } from 'react'
import { Button } from '~/components/ui/Button'
import { formatBytes } from '~/helpers/transferProgress'
import { useTranslation } from '~/context/TranslationContext'

const DROP_ZONE_CLASS_NAME = 'relative flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-muted/50 px-4 py-8 '
  + 'text-center transition-colors hover:border-foreground hover:bg-surface-hover focus-within:border-foreground'

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
      <label className={ DROP_ZONE_CLASS_NAME }>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-8 fill-none stroke-current stroke-[1.5] text-muted"
        >
          <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
        </svg>

        { file
          ? (
            <span className="text-sm break-all text-foreground">
              { file.name } <span className="text-muted">({ formatBytes(file.size) })</span>
            </span>
          )
          : (
            <>
              <span className="text-sm font-medium text-foreground">{ t('transfer.selectFile') }</span>
              <span className="hidden text-xs text-muted sm:block">{ t('transfer.dropHint') }</span>
            </>
          ) }

        <input
          type="file"
          onChange={ handleChange }
          aria-label={ t('transfer.selectFile') }
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>

      <Button disabled={ !canConfirm || !file } onClick={ onConfirm }>{ t('transfer.confirm') }</Button>
    </section>
  )
}
