import { ToolPage } from '~/components/Layout/ToolPage'
import { CreatedSecret } from '~/components/Secrets/CreatedSecret'
import { useCreateSecret } from '~/hooks/useCreateSecret'
import { useTranslation } from '~/context/TranslationContext'
import { CreateSecretForm } from '~/components/Secrets/CreateSecretForm'

export function CreateSecret() {
  const { t } = useTranslation()
  const { state, submit, reset } = useCreateSecret()

  return (
    <ToolPage title={ t('landing.secrets.title') } description={ t('secrets.create.description') }>
      { state.status === 'created'
        ? (
          <CreatedSecret
            link={ state.link }
            timeToLiveMinutes={ state.timeToLiveMinutes }
            maxViews={ state.maxViews }
            onCreateAnother={ reset }
          />
        )
        : <CreateSecretForm disabled={ state.status === 'submitting' } onSubmit={ (secret) => void submit(secret) } /> }

      { state.status === 'failed' && (
        <p role="alert" className="text-sm text-foreground">
          { t(state.network ? 'common.networkError' : 'secrets.create.failed') }
        </p>
      ) }
    </ToolPage>
  )
}
