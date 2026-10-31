export type Bytes = Uint8Array<ArrayBuffer>

export function encodeBase64Url(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

export function decodeBase64Url(value: string): Bytes {
  const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/'))

  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}
