import { useRouter } from 'next/router'
import { ReadSecret } from '~/components/Secrets/ReadSecret'
import { BrowserTranslation } from '~/components/Layout/BrowserTranslation'

export default function ReadSecretPage() {
  const { isReady, query } = useRouter()

  if (!isReady || typeof query.id !== 'string') {
    return null
  }

  return (
    <BrowserTranslation>
      <ReadSecret id={ query.id } />
    </BrowserTranslation>
  )
}
