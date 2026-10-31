import { FormEvent, useState } from 'react'
import { Button } from '~/components/ui/Button'
import { useTranslation } from '~/context/TranslationContext'
import { generateSessionCode, normalizeSessionCode } from '~/crypto/chatCrypto'
import { FIELD_CLASS_NAME, LABEL_CLASS_NAME } from '~/components/ui/fieldStyles'

const SESSION_CODE_LENGTH = 16
const MIN_PASSWORD_LENGTH = 8

interface Props {
  onJoin: (sessionCode: string, password: string) => void
}

export function ChatJoinForm({ onJoin }: Props) {
  const { t } = useTranslation()
  const [sessionCode, setSessionCode] = useState('')
  const [password, setPassword] = useState('')

  const canJoin = normalizeSessionCode(sessionCode).length === SESSION_CODE_LENGTH && password.length >= MIN_PASSWORD_LENGTH

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (canJoin) {
      onJoin(sessionCode, password)
    }
  }

  return (
    <form onSubmit={ handleSubmit } className="flex flex-col gap-5">
      <div>
        <label htmlFor="chat-code" className={ LABEL_CLASS_NAME }>{ t('chat.code') }</label>
        <div className="flex gap-2">
          <input
            id="chat-code"
            autoComplete="off"
            spellCheck={ false }
            value={ sessionCode }
            onChange={ (event) => setSessionCode(event.target.value) }
            className={ `${FIELD_CLASS_NAME} font-mono` }
          />
          <Button variant="secondary" onClick={ () => setSessionCode(generateSessionCode()) }>{ t('chat.generate') }</Button>
        </div>
      </div>

      <div>
        <label htmlFor="chat-password" className={ LABEL_CLASS_NAME }>{ t('secrets.password') }</label>
        <input
          id="chat-password"
          type="password"
          autoComplete="off"
          value={ password }
          onChange={ (event) => setPassword(event.target.value) }
          className={ FIELD_CLASS_NAME }
        />
        <p className="mt-1.5 text-xs text-muted">{ t('chat.passwordHint') }</p>
      </div>

      <Button type="submit" disabled={ !canJoin }>{ t('chat.join') }</Button>
    </form>
  )
}
