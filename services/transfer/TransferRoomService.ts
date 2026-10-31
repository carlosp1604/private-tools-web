import { postJson } from '~/helpers/apiClient'
import { fail, Result, success } from '~/types/Result'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

export type RoomAvailabilityError = 'not_found' | 'network'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export async function reserveRoom(): Promise<Result<string, 'failed'>> {
  const result = await postJson('/api/transfers', {})

  if (!result.success || result.value.status !== 201) {
    return fail('failed')
  }

  const { body } = result.value

  return isRecord(body) && typeof body.code === 'string' ? success(body.code) : fail('failed')
}

export async function checkRoomAvailability(code: string): Promise<Result<void, RoomAvailabilityError>> {
  try {
    const response = await fetch(`${API_URL}/api/transfers/${encodeURIComponent(code)}`, { referrerPolicy: 'no-referrer' })

    return response.status === 204 ? success(undefined) : fail('not_found')
  } catch {
    return fail('network')
  }
}

export function openTransferSocket(code: string): WebSocket {
  const origin = (API_URL || location.origin).replace(/^http/, 'ws')
  const socket = new WebSocket(`${origin}/api/transfers/${encodeURIComponent(code)}/ws`)

  socket.binaryType = 'arraybuffer'

  return socket
}
