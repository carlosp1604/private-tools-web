import { fail, Result, success } from '~/types/Result'

export interface ApiResponse {
  status: number
  body: unknown
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

export async function postJson(path: string, payload: unknown): Promise<Result<ApiResponse, 'network'>> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      referrerPolicy: 'no-referrer',
    })

    return success({ status: response.status, body: await response.json().catch(() => null) })
  } catch {
    return fail('network')
  }
}
