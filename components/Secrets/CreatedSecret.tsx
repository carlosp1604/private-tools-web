import { Button } from '~/components/ui/Button'
import { interpolate } from '~/helpers/interpolate'
import { useTranslation } from '~/context/TranslationContext'
import { useCopyToClipboard } from '~/hooks/useCopyToClipboard'
import { FIELD_CLASS_NAME, LABEL_CLASS_NAME } from '~/components/ui/fieldStyles'

interface Props {
  link: string
  timeToLiveMinutes: number
  maxViews: number
  onCreateAnother: () => void
}

export function CreatedSecret({ link, timeToLiveMinutes, maxViews, onCreateAnother }: Props) {
  const { t } = useTranslation()
  const { copied, copy } = useCopyToClipboard()

  return (
    <section className="flex flex-col gap-5">
      <div>
        <label htmlFor="secret-link" className={ LABEL_CLASS_NAME }>{ t('secrets.created.link') }</label>
        <input id="secret-link" readOnly value={ link } className={ FIELD_CLASS_NAME } />
      </div>

      <p className="text-sm leading-6 text-muted">{ t('secrets.created.notice') }</p>
      <p className="text-sm leading-6 text-muted">
        { interpolate(t('secrets.created.limits'), { minutes: timeToLiveMinutes, views: maxViews }) }
      </p>

      <div className="flex flex-wrap gap-3">
        <Button onClick={ () => void copy(link) }>{ t(copied ? 'common.copied' : 'common.copy') }</Button>
        <Button variant="secondary" onClick={ onCreateAnother }>{ t('secrets.created.another') }</Button>
      </div>
    </section>
  )
}
