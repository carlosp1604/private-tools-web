import { FormEvent, useState } from 'react'
import { Bytes } from '~/crypto/base64Url'
import { Button } from '~/components/ui/Button'
import { interpolate } from '~/helpers/interpolate'
import { useReadSecret } from '~/hooks/useReadSecret'
import { RevealedSecret } from '~/components/Secrets/RevealedSecret'
import { useTranslation } from '~/context/TranslationContext'
import { FIELD_CLASS_NAME, LABEL_CLASS_NAME } from '~/components/ui/fieldStyles'

const FAILURE_MESSAGES = {
  not_found: 'secrets.read.failed',
  network: 'common.networkError',
  unexpected: 'secrets.read.unexpected',
} as const

interface Props {
  id: string
  linkKey: Bytes
}

export function ReadSecretForm({ id, linkKey }: Props) {
  const { t } = useTranslation()
  const { state, cooldown, submit } = useReadSecret(id, linkKey)
  const [password, setPassword] = useState('')

  if (state.status === 'revealed') {
    return <RevealedSecret text={ state.text } />
  }

  const submitting = state.status === 'submitting'

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (password && !submitting && cooldown === 0) {
      void submit(password)
    }
  }

  return (
    <form onSubmit={ handleSubmit } className="flex flex-col gap-5">
      <div>
        <label htmlFor="read-password" className={ LABEL_CLASS_NAME }>{ t('secrets.password') }</label>
        <input
          id="read-password"
          type="password"
          autoComplete="off"
          autoFocus
          value={ password }
          onChange={ (event) => setPassword(event.target.value) }
          className={ FIELD_CLASS_NAME }
        />
      </div>

      { state.status === 'failed' && <p role="alert" className="text-sm text-foreground">{ t(FAILURE_MESSAGES[state.reason]) }</p> }

      <Button type="submit" disabled={ !password || submitting || cooldown > 0 }>
        { cooldown > 0 ? interpolate(t('secrets.read.retryIn'), { seconds: cooldown }) : t('secrets.read.submit') }
      </Button>
    </form>
  )
}
