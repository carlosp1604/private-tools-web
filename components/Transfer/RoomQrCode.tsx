import { useMemo } from 'react'
import { encode } from 'uqr'

interface Props {
  value: string
  label: string
}

export function RoomQrCode({ value, label }: Props) {
  const { path, size } = useMemo(() => {
    const { data, size: modules } = encode(value)

    const squares = data.flatMap((row, y) => row.flatMap((dark, x) => (dark ? [`M${x} ${y}h1v1h-1z`] : [])))

    return { path: squares.join(''), size: modules }
  }, [value])

  return (
    <svg role="img" aria-label={ label } viewBox={ `-2 -2 ${size + 4} ${size + 4}` } className="size-44 rounded-xl bg-accent">
      <path d={ path } className="fill-background" />
    </svg>
  )
}
