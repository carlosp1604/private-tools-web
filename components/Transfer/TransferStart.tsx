import { FormEvent, useState } from 'react'
import { Button } from '~/components/ui/Button'
import { useTranslation } from '~/context/TranslationContext'
import { FIELD_CLASS_NAME, LABEL_CLASS_NAME } from '~/components/ui/fieldStyles'

const ROOM_CODE_CHARACTERS = 8

interface Props {
  onSend: () => void
  onReceive: (code: string) => void
}

export function TransferStart({ onSend, onReceive }: Props) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')

  const canReceive = code.replace(/[\s-]/g, '').length === ROOM_CODE_CHARACTERS

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (canReceive) {
      onReceive(code)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <Button onClick={ onSend }>{ t('transfer.send') }</Button>

      <form onSubmit={ handleSubmit } className="flex flex-col gap-3">
        <label htmlFor="transfer-code" className={ LABEL_CLASS_NAME }>{ t('transfer.receiveLabel') }</label>
        <input
          id="transfer-code"
          autoComplete="off"
          spellCheck={ false }
          value={ code }
          onChange={ (event) => setCode(event.target.value) }
          className={ `${FIELD_CLASS_NAME} font-mono uppercase` }
        />
        <Button type="submit" variant="secondary" disabled={ !canReceive }>{ t('transfer.receive') }</Button>
      </form>

      <p className="text-xs leading-5 text-muted">{ t('transfer.notice') }</p>
    </div>
  )
}
