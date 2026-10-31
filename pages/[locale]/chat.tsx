import { Chat } from '~/components/Chat/Chat'
import { getLocalePaths, getLocaleProps } from '~/helpers/localePaths'

export const getStaticPaths = getLocalePaths
export const getStaticProps = getLocaleProps

export default Chat
