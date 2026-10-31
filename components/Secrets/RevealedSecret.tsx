import { Button } from '~/components/ui/Button'
import { useTranslation } from '~/context/TranslationContext'
import { useCopyToClipboard } from '~/hooks/useCopyToClipboard'
import { FIELD_CLASS_NAME } from '~/components/ui/fieldStyles'

interface Props {
  text: string
}

export function RevealedSecret({ text }: Props) {
  const { t } = useTranslation()
  const { copied, copy } = useCopyToClipboard()

  return (
    <section className="flex flex-col gap-5">
      <textarea
        readOnly
        rows={ 8 }
        value={ text }
        aria-label={ t('secrets.read.content') }
        className={ `${FIELD_CLASS_NAME} resize-y` }
      />
      <p className="text-sm leading-6 text-muted">{ t('secrets.read.warning') }</p>

      <div>
        <Button onClick={ () => void copy(text) }>{ t(copied ? 'common.copied' : 'common.copy') }</Button>
      </div>
    </section>
  )
}
