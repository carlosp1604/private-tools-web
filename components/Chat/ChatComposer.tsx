import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'
import { Button } from '~/components/ui/Button'
import { MAX_MESSAGE_BYTES } from '~/crypto/chatCrypto'
import { useTranslation } from '~/context/TranslationContext'
import { FIELD_CLASS_NAME } from '~/components/ui/fieldStyles'

interface Props {
  disabled: boolean
  onSend: (text: string) => void
}

export function ChatComposer({ disabled, onSend }: Props) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const textarea = textareaRef.current

    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight + textarea.offsetHeight - textarea.clientHeight}px`
    }
  }, [text])

  const tooLong = new TextEncoder().encode(text).length > MAX_MESSAGE_BYTES
  const canSend = text.trim().length > 0 && !tooLong && !disabled

  const send = () => {
    if (canSend) {
      onSend(text)
      setText('')
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    send()
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send()
    }
  }

  return (
    <form onSubmit={ handleSubmit } className="flex flex-col gap-1.5">
      <div className="flex items-end gap-2">
        <textarea
          ref={ textareaRef }
          rows={ 1 }
          value={ text }
          disabled={ disabled }
          aria-label={ t('chat.message') }
          placeholder={ t('chat.message') }
          onChange={ (event) => setText(event.target.value) }
          onKeyDown={ handleKeyDown }
          className={ `${FIELD_CLASS_NAME} max-h-40 resize-none disabled:opacity-50` }
        />
        <Button type="submit" disabled={ !canSend }>{ t('chat.send') }</Button>
      </div>
      { tooLong && <p role="alert" className="text-sm text-foreground">{ t('chat.messageTooLong') }</p> }
    </form>
  )
}
