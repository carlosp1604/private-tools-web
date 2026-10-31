import { useEffect, useState } from 'react'
import { Bytes, encodeBase64Url } from '~/crypto/base64Url'
import { readSecret } from '~/services/secret/SecretService'
import { decryptSecret, deriveSecretKeys } from '~/crypto/secretCrypto'

const MAX_COOLDOWN_SECONDS = 30

export type ReadSecretState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'failed'; reason: 'not_found' | 'network' | 'unexpected' }
  | { status: 'revealed'; text: string }

export function useReadSecret(id: string, linkKey: Bytes) {
  const [state, setState] = useState<ReadSecretState>({ status: 'idle' })
  const [failures, setFailures] = useState(0)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown === 0) {
      return
    }

    const timeout = setTimeout(() => setCooldown(cooldown - 1), 1_000)

    return () => clearTimeout(timeout)
  }, [cooldown])

  const fail = (reason: 'not_found' | 'network' | 'unexpected') => {
    setState({ status: 'failed', reason })
    setFailures(failures + 1)
    setCooldown(Math.min(2 ** failures, MAX_COOLDOWN_SECONDS))
  }

  const submit = async (password: string) => {
    setState({ status: 'submitting' })

    const { authKey, encryptionKey } = await deriveSecretKeys(linkKey, password)
    const result = await readSecret(id, encodeBase64Url(authKey))

    if (!result.success) {
      fail(result.error === 'invalid_response' ? 'unexpected' : result.error)

      return
    }

    try {
      setState({ status: 'revealed', text: await decryptSecret(result.value, encryptionKey) })
    } catch {
      fail('unexpected')
    }
  }

  return { state, cooldown, submit }
}
