import { useTranslation } from '~/context/TranslationContext'

const BUBBLE_CLASS_NAME = 'relative max-w-[85%] rounded-xl px-3 pt-1.5 pb-1 text-sm leading-6 after:absolute after:top-0 after:size-0 '
  + 'after:border-solid after:content-[\'\']'

const MINE_CLASS_NAME = 'self-end rounded-tr-none bg-accent text-background after:-right-2 '
  + 'after:border-t-[10px] after:border-r-[10px] after:border-t-accent after:border-r-transparent'

const THEIRS_CLASS_NAME = 'self-start rounded-tl-none bg-surface text-foreground after:-left-2 '
  + 'after:border-t-[10px] after:border-l-[10px] after:border-t-surface after:border-l-transparent'

interface Props {
  mine: boolean
  author: string
  text: string
  sentAt: Date
}

export function ChatBubble({ mine, author, text, sentAt }: Props) {
  const { locale, t } = useTranslation()
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(sentAt)

  return (
    <article className={ `flex max-w-full flex-col gap-0.5 ${mine ? 'items-end' : 'items-start'}` }>
      <span className="px-1 text-xs text-muted">{ mine ? t('chat.you') : author }</span>
      <div className={ `${BUBBLE_CLASS_NAME} ${mine ? MINE_CLASS_NAME : THEIRS_CLASS_NAME}` }>
        <p className="break-words whitespace-pre-wrap">{ text }</p>
        <time dateTime={ sentAt.toISOString() } className="block text-right text-[11px] leading-4 opacity-60">{ time }</time>
      </div>
    </article>
  )
}
