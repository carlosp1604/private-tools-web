import { FormEvent, useState } from 'react'
import { Button } from '~/components/ui/Button'
import { NewSecret } from '~/hooks/useCreateSecret'
import { useTranslation } from '~/context/TranslationContext'
import { MAX_SECRET_TEXT_BYTES } from '~/crypto/secretCrypto'
import { FIELD_CLASS_NAME, LABEL_CLASS_NAME } from '~/components/ui/fieldStyles'

const MIN_PASSWORD_LENGTH = 8
const TIME_TO_LIVE_MINUTES = [1, 5, 10, 15]
const MAX_VIEWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

interface Props {
  disabled: boolean
  onSubmit: (secret: NewSecret) => void
}

export function CreateSecretForm({ disabled, onSubmit }: Props) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [timeToLiveMinutes, setTimeToLiveMinutes] = useState(15)
  const [maxViews, setMaxViews] = useState(1)

  const textTooLarge = new TextEncoder().encode(text).length > MAX_SECRET_TEXT_BYTES
  const canSubmit = text.length > 0 && !textTooLarge && password.length >= MIN_PASSWORD_LENGTH && !disabled

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (canSubmit) {
      onSubmit({ text, password, timeToLiveMinutes, maxViews })
    }
  }

  return (
    <form onSubmit={ handleSubmit } className="flex flex-col gap-5">
      <div>
        <label htmlFor="secret-text" className={ LABEL_CLASS_NAME }>{ t('secrets.create.text') }</label>
        <textarea
          id="secret-text"
          rows={ 6 }
          value={ text }
          onChange={ (event) => setText(event.target.value) }
          className={ `${FIELD_CLASS_NAME} resize-y` }
        />
        { textTooLarge && <p role="alert" className="mt-1.5 text-sm text-foreground">{ t('secrets.create.textTooLarge') }</p> }
      </div>

      <div>
        <label htmlFor="secret-password" className={ LABEL_CLASS_NAME }>{ t('secrets.password') }</label>
        <div className="flex gap-2">
          <input
            id="secret-password"
            type={ passwordVisible ? 'text' : 'password' }
            autoComplete="off"
            value={ password }
            onChange={ (event) => setPassword(event.target.value) }
            className={ FIELD_CLASS_NAME }
          />
          <Button variant="secondary" onClick={ () => setPasswordVisible(!passwordVisible) }>
            { t(passwordVisible ? 'secrets.password.hide' : 'secrets.password.show') }
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-muted">{ t('secrets.create.passwordHint') }</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="secret-time-to-live" className={ LABEL_CLASS_NAME }>{ t('secrets.create.timeToLive') }</label>
          <select
            id="secret-time-to-live"
            value={ timeToLiveMinutes }
            onChange={ (event) => setTimeToLiveMinutes(Number(event.target.value)) }
            className={ FIELD_CLASS_NAME }
          >
            { TIME_TO_LIVE_MINUTES.map((minutes) => <option key={ minutes } value={ minutes }>{ minutes } min</option>) }
          </select>
        </div>

        <div>
          <label htmlFor="secret-max-views" className={ LABEL_CLASS_NAME }>{ t('secrets.create.maxViews') }</label>
          <select
            id="secret-max-views"
            value={ maxViews }
            onChange={ (event) => setMaxViews(Number(event.target.value)) }
            className={ FIELD_CLASS_NAME }
          >
            { MAX_VIEWS.map((views) => <option key={ views } value={ views }>{ views }</option>) }
          </select>
        </div>
      </div>

      <Button type="submit" disabled={ !canSubmit }>
        { t(disabled ? 'secrets.create.submitting' : 'secrets.create.submit') }
      </Button>
    </form>
  )
}
