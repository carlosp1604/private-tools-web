import { Transfer } from '~/components/Transfer/Transfer'
import { getLocalePaths, getLocaleProps } from '~/helpers/localePaths'

export const getStaticPaths = getLocalePaths
export const getStaticProps = getLocaleProps

export default function FilesPage() {
  return <Transfer />
}
