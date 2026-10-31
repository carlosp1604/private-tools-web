import { useState } from 'react'
import { encryptSecret } from '~/crypto/secretCrypto'
import { createSecret } from '~/services/secret/SecretService'
import { buildSecretLink } from '~/helpers/secretLink'

export interface NewSecret {
  text: string
  password: string
  timeToLiveMinutes: number
  maxViews: number
}

export type CreateSecretState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'failed'; network: boolean }
  | { status: 'created'; link: string; timeToLiveMinutes: number; maxViews: number }

export function useCreateSecret() {
  const [state, setState] = useState<CreateSecretState>({ status: 'idle' })

  const submit = async ({ text, password, timeToLiveMinutes, maxViews }: NewSecret) => {
    setState({ status: 'submitting' })

    const { linkKey, ...encrypted } = await encryptSecret(text, password)
    const result = await createSecret({ ...encrypted, timeToLiveSeconds: timeToLiveMinutes * 60, maxViews })

    if (!result.success) {
      setState({ status: 'failed', network: result.error === 'network' })

      return
    }

    setState({ status: 'created', link: buildSecretLink(location.origin, result.value, linkKey), timeToLiveMinutes, maxViews })
  }

  const reset = () => setState({ status: 'idle' })

  return { state, submit, reset }
}
