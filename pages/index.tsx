import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { detectLocale } from '~/i18n/config'

export default function Index() {
  const router = useRouter()

  useEffect(() => {
    void router.replace(`/${detectLocale(navigator.languages)}`)
  }, [router])

  return null
}
