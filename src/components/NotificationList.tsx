import React, { useEffect, useState } from 'react'
import { ChatCircle, ArrowBendUpLeft, At, UserPlus, PaperPlaneTilt } from '@phosphor-icons/react'
import { hilosApi } from '../lib/hilosClient'
import { timeAgo } from '../lib/time'

interface N {
  id: number; type: string; postId: number | null; commentId: number | null
  preview: string | null; read: boolean; createdAt: string
  actor: { handle: string; displayName?: string | null; avatarUrl?: string | null; type?: string } | null
}

const ICON: Record<string, any> = { comment: ChatCircle, reply: ArrowBendUpLeft, mention: At, follow: UserPlus, message: PaperPlaneTilt }
const VERB: Record<string, string> = {
  comment: 'comentó tu publicación',
  reply: 'respondió a tu comentario',
  mention: 'te mencionó',
  follow: 'te empezó a seguir',
  message: 'te envió un mensaje',
}

const NotificationList: React.FC<{ initial: N[]; hasMore: boolean }> = ({ initial, hasMore: more0 }) => {
  const [items, setItems] = useState<N[]>(initial || [])
  const [hasMore, setHasMore] = useState(more0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)

  // Al abrir la vista se dan por vistos: el contador deja de insistir.
  useEffect(() => {
    hilosApi.readNotifications().catch(() => {})
    window.dispatchEvent(new CustomEvent('lc:notifs-read'))
  }, [])

  const loadMore = async () => {
    setLoading(true)
    try {
      const n = page + 1
      const d = await hilosApi.notifications(n)
      setItems((l) => [...l, ...(d?.items || [])])
      setHasMore(!!d?.hasMore)
      setPage(n)
    } catch { setHasMore(false) } finally { setLoading(false) }
  }

  const href = (n: N) =>
    n.type === 'follow' ? `/@${n.actor?.handle}`
    : n.type === 'message' ? '/?chat=1'
    : n.postId ? `/post/${n.postId}` : '/'

  if (!items.length) {
    return (
      <div className="py-24 text-center">
        <ChatCircle size={34} className="ink-3 mx-auto mb-4" />
        <p className="t-body ink-2">Todavía no tienes avisos.</p>
        <p className="t-sub mt-1">Cuando alguien te responda, te mencione o te siga, aparecerá aquí.</p>
      </div>
    )
  }

  return (
    <div>
      {items.map((n) => {
        const Icon = ICON[n.type] || ChatCircle
        const name = n.actor?.displayName || n.actor?.handle || 'Alguien'
        return (
          <a key={n.id} href={href(n)} className="row flex items-start gap-3.5 py-4" style={{ borderBottom: '1px solid var(--line)' }}>
            <span className="relative shrink-0">
              {n.actor?.avatarUrl
                ? <img src={n.actor.avatarUrl} alt="" className={`object-cover ${n.actor.type === 'user' ? 'rounded-full' : 'rounded-xl'}`} style={{ width: 44, height: 44 }} />
                : <span className={`grid place-items-center text-[15px] font-semibold ${n.actor?.type === 'user' ? 'rounded-full' : 'rounded-xl'}`}
                    style={{ width: 44, height: 44, background: 'var(--soft)', color: 'var(--blue)' }}>{name[0]?.toUpperCase()}</span>}
              <span className="absolute -bottom-1 -right-1 grid place-items-center rounded-full"
                style={{ width: 20, height: 20, background: 'var(--blue)', color: '#fff', border: '2px solid var(--paper)' }}>
                <Icon size={11} weight="fill" />
              </span>
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-[15px]">
                <b className="font-semibold" data-hover-handle={n.actor?.handle}>{name}</b>{' '}
                <span className="ink-2">{VERB[n.type] || 'interactuó contigo'}</span>
                <span className="t-caption"> · {timeAgo(n.createdAt)}</span>
              </span>
              {n.preview && <span className="block t-sub truncate mt-0.5">{n.preview}</span>}
            </span>

            {!n.read && <span className="w-2 h-2 rounded-full shrink-0 mt-2" style={{ background: 'var(--blue)' }} />}
          </a>
        )
      })}

      {loading && (
        <div className="py-5 space-y-4" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3.5">
              <div className="skeleton rounded-full shrink-0" style={{ width: 44, height: 44 }} />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3.5 rounded" style={{ width: '54%' }} />
                <div className="skeleton h-3 rounded" style={{ width: '34%' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <button type="button" onClick={loadMore} className="chip w-full justify-center mt-6 cursor-pointer">Ver más avisos</button>
      )}
    </div>
  )
}
export default NotificationList
