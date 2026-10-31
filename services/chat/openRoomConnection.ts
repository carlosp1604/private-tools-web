import { Bytes } from '~/crypto/base64Url'
import { ChatSession, ChatSessionListener } from '~/services/chat/ChatSession'

const API_URL = process.env.NEXT_PUBLIC_API_URL

export function openRoomConnection(roomId: string, authKey: Bytes, displayName: string, listener: ChatSessionListener): ChatSession {
  const origin = (API_URL ?? location.origin).replace(/^http/, 'ws')
  const socket = new WebSocket(`${origin}/api/rooms/${roomId}/ws`)

  socket.binaryType = 'arraybuffer'

  const session = new ChatSession({ send: (frame) => socket.send(frame), close: () => socket.close() }, authKey, displayName, listener)

  socket.addEventListener('open', () => session.handleOpen())
  socket.addEventListener('close', (event) => session.handleClose(event.code))
  socket.addEventListener('message', (event: MessageEvent<string | ArrayBuffer>) => {
    if (typeof event.data === 'string') {
      session.handleNotice(event.data)
    } else {
      session.handleFrame(new Uint8Array(event.data))
    }
  })

  return session
}
