import { useRouter } from 'next/router'
import { Transfer } from '~/components/Transfer/Transfer'
import { BrowserTranslation } from '~/components/Layout/BrowserTranslation'

export default function ReceiveFilePage() {
  const { isReady, query } = useRouter()

  if (!isReady || typeof query.code !== 'string') {
    return null
  }

  return (
    <BrowserTranslation>
      <Transfer initialCode={ query.code } expectedCommitment={ location.hash.replace(/^#/, '') || undefined } />
    </BrowserTranslation>
  )
}
