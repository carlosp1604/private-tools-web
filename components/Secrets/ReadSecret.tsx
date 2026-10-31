import { useState } from 'react'
import { ToolPage } from '~/components/Layout/ToolPage'
import { parseLinkKey } from '~/helpers/secretLink'
import { ReadSecretForm } from '~/components/Secrets/ReadSecretForm'
import { useTranslation } from '~/context/TranslationContext'

interface Props {
  id: string
}

export function ReadSecret({ id }: Props) {
  const { t } = useTranslation()
  // This component only mounts in the browser, because the static page renders nothing until it knows the language
  const [linkKey] = useState(() => parseLinkKey(location.hash))

  return (
    <ToolPage title={ t('secrets.read.title') } description={ t('secrets.read.description') }>
      { !linkKey && <p role="alert" className="text-sm text-foreground">{ t('secrets.read.invalidLink') }</p> }
      { linkKey && <ReadSecretForm id={ id } linkKey={ linkKey } /> }
    </ToolPage>
  )
}
