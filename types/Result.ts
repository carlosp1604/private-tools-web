export type Result<T, E> = { success: true; value: T } | { success: false; error: E }

export function success<T, E = never>(value: T): Result<T, E> {
  return { success: true, value }
}

export function fail<T = never, E = Error>(error: E): Result<T, E> {
  return { success: false, error }
}
