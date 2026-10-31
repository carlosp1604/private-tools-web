import { postJson } from '~/helpers/apiClient'
import { SecretContent } from '~/crypto/secretCrypto'
import { fail, Result, success } from '~/types/Result'

export const SECRET_NOT_FOUND = 'secret_not_found'

export type CreateSecretError = 'network' | 'rejected' | 'invalid_response'
export type ReadSecretError = 'network' | 'not_found' | 'invalid_response'

export interface CreateSecretPayload {
  iv: string
  ciphertext: string
  authHash: string
  timeToLiveSeconds: number
  maxViews: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export async function createSecret(payload: CreateSecretPayload): Promise<Result<string, CreateSecretError>> {
  const result = await postJson('/api/secrets', payload)

  if (!result.success) {
    return fail('network')
  }

  const { status, body } = result.value

  if (status !== 201) {
    return fail(status >= 400 && status < 500 ? 'rejected' : 'invalid_response')
  }

  if (!isRecord(body) || typeof body.id !== 'string') {
    return fail('invalid_response')
  }

  return success(body.id)
}

export async function readSecret(id: string, authKey: string): Promise<Result<SecretContent, ReadSecretError>> {
  const result = await postJson(`/api/secrets/${encodeURIComponent(id)}/read`, { authKey })

  if (!result.success) {
    return fail('network')
  }

  const { status, body } = result.value

  if (status === 404 && isRecord(body) && body.code === SECRET_NOT_FOUND) {
    return fail('not_found')
  }

  if (status !== 200 || !isRecord(body) || typeof body.iv !== 'string' || typeof body.ciphertext !== 'string') {
    return fail('invalid_response')
  }

  return success({ iv: body.iv, ciphertext: body.ciphertext })
}
