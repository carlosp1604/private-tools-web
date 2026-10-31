import { CreateSecret } from '~/components/Secrets/CreateSecret'
import { getLocalePaths, getLocaleProps } from '~/helpers/localePaths'

export const getStaticPaths = getLocalePaths
export const getStaticProps = getLocaleProps

export default CreateSecret
