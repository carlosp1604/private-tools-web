import { estimateRemainingSeconds, formatBytes, formatDuration, updateSpeed } from '~/helpers/transferProgress'

describe('transferProgress', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1536, '1.5 KB'],
    [5 * 1024 ** 2, '5.0 MB'],
    [3 * 1024 ** 3, '3.0 GB'],
  ])('should format %d bytes', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected)
  })

  it('should start from the first measure', () => {
    const first = updateSpeed(null, 0, 1_000)

    expect(updateSpeed(first, 1_000, 2_000).bytesPerSecond).toBe(1_000)
  })

  it('should smooth a sudden change', () => {
    const speed = updateSpeed({ bytes: 1_000, time: 2_000, bytesPerSecond: 1_000 }, 11_000, 3_000).bytesPerSecond

    expect(speed).toBe(2_800)
  })

  it('should ignore a measure without elapsed time', () => {
    expect(updateSpeed({ bytes: 10, time: 5, bytesPerSecond: 7 }, 20, 5).bytesPerSecond).toBe(7)
  })

  it('should estimate the remaining time', () => {
    expect(estimateRemainingSeconds(2_500, 1_000)).toBe(3)
  })

  it('should not estimate without a speed', () => {
    expect(estimateRemainingSeconds(2_500, 0)).toBeNull()
  })

  it('should format a duration', () => {
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(9)).toBe('0:09')
  })
})
