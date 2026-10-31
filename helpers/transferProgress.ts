const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB']
const BYTES_PER_UNIT = 1024
const SPEED_SMOOTHING = 0.2
const SECONDS_PER_MINUTE = 60

export interface SpeedSample {
  bytes: number
  time: number
  bytesPerSecond: number
}

export function formatBytes(bytes: number): string {
  const unit = Math.min(Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(BYTES_PER_UNIT)), BYTE_UNITS.length - 1)
  const value = bytes / BYTES_PER_UNIT ** unit

  return `${value.toFixed(unit === 0 ? 0 : 1)} ${BYTE_UNITS[unit]}`
}

/**
 * Smooths the speed, because the raw value jumps with each acknowledgement and would make the estimate unreadable
 */
export function updateSpeed(previous: SpeedSample | null, bytes: number, time: number): SpeedSample {
  if (!previous || time <= previous.time) {
    return { bytes, time, bytesPerSecond: previous?.bytesPerSecond ?? 0 }
  }

  const current = ((bytes - previous.bytes) * 1000) / (time - previous.time)
  const smoothed = previous.bytesPerSecond + SPEED_SMOOTHING * (current - previous.bytesPerSecond)
  const bytesPerSecond = previous.bytesPerSecond === 0 ? current : smoothed

  return { bytes, time, bytesPerSecond }
}

export function estimateRemainingSeconds(remainingBytes: number, bytesPerSecond: number): number | null {
  return bytesPerSecond > 0 ? Math.ceil(remainingBytes / bytesPerSecond) : null
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE)

  return `${minutes}:${String(seconds % SECONDS_PER_MINUTE).padStart(2, '0')}`
}
