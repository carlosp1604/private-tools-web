import { interpolate } from '~/helpers/interpolate'
import { TransferProgress } from '~/hooks/useTransfer'
import { useTranslation } from '~/context/TranslationContext'
import { formatBytes, formatDuration } from '~/helpers/transferProgress'

interface Props {
  progress: TransferProgress
  totalBytes: number
}

export function TransferProgressBar({ progress, totalBytes }: Props) {
  const { t } = useTranslation()
  const { bytes, bytesPerSecond, remainingSeconds } = progress

  return (
    <section className="flex flex-col gap-2">
      <progress value={ bytes } max={ totalBytes || 1 } aria-label={ t('transfer.progress') } className="h-2 w-full accent-accent" />

      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted">
        <span>{ formatBytes(bytes) } / { formatBytes(totalBytes) }</span>
        { bytesPerSecond > 0 && <span>{ formatBytes(bytesPerSecond) }/s</span> }
        { remainingSeconds !== null && (
          <span>{ interpolate(t('transfer.remaining'), { time: formatDuration(remainingSeconds) }) }</span>
        ) }
      </div>
    </section>
  )
}
