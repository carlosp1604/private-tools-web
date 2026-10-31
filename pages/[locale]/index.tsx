import { Landing } from '~/components/Landing/Landing'
import { getLocalePaths, getLocaleProps } from '~/helpers/localePaths'

export const getStaticPaths = getLocalePaths
export const getStaticProps = getLocaleProps

export default Landing
