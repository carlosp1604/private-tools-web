export function interpolate(message: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), message)
}
