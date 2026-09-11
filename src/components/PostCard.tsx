import React from 'react'
import PostActions from './PostActions'
import { timeAgo } from '../lib/time'

export interface PostShape {
  id: number
  content: string
  createdAt: string
  likesCount?: number
  commentsCount?: number
  liked?: boolean
  saved?: boolean
  pending?: boolean
  author?: { handle: string; type?: string; displayName?: string | null; avatarUrl?: string | null }
}

const isMedia = (u: string) => /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(u) || u.includes('r2.hilos.rest')

function tokenize(c: string) {
  return (c || '').split(/(\s+)/).map((w, i) => {
    if (/^#[\p{L}\p{N}_]+$/u.test(w)) return <a key={i} href={`/tag/${w.slice(1)}`} className="text-blue hover:opacity-70">{w}</a>
    if (/^@[a-zA-Z0-9_]+$/.test(w)) return <a key={i} href={`/${w}`} className="text-blue hover:opacity-70">{w}</a>
    if (/^https?:\/\/\S+$/.test(w)) return <a key={i} href={w} target="_blank" rel="noopener" className="text-blue break-all hover:opacity-70">{w}</a>
    return <React.Fragment key={i}>{w}</React.Fragment>
  })
}

// Mismo diseño que PostList.astro, pero en React: lo usa el feed para los
// posts recien publicados (optimistas) sin recargar la pagina.
const PostCard: React.FC<{ post: PostShape; logged: boolean }> = ({ post: p, logged }) => {
  const imgs = (p.content || '').split(/\s+/).filter((w) => /^https?:\/\//.test(w) && isMedia(w))
  const body = (p.content || '').split('\n').filter((l) => !imgs.includes(l.trim())).join('\n')
  const name = p.author?.displayName || p.author?.handle || ''

  return (
    <article className="row py-6 rise" style={{ borderBottom: '1px solid var(--line)', opacity: p.pending ? 0.55 : 1 }}>
      <div className="flex gap-3.5">
        <a href={`/@${p.author?.handle}`} data-hover-handle={p.author?.handle} className="shrink-0">
          {p.author?.avatarUrl
            ? <img src={p.author.avatarUrl} alt="" className={`w-11 h-11 object-cover ${p.author.type === 'user' ? 'rounded-full' : 'rounded-xl'}`} />
            : <span className={`grid place-items-center w-11 h-11 font-semibold ${p.author?.type === 'user' ? 'rounded-full' : 'rounded-xl'}`} style={{ background: '#dbe8fb', color: 'var(--blue)' }}>{(name || '?')[0]?.toUpperCase()}</span>}
        </a>
        <div className="min-w-0 flex-1 max-w-[760px]">
          <div className="flex items-center gap-2 flex-wrap">
            <a href={`/@${p.author?.handle}`} data-hover-handle={p.author?.handle} className="text-[16px] font-semibold hover:opacity-70 truncate">{name}</a>
            {p.author?.type === 'scan' && <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: '#e8f4f6', color: 'var(--aqua)' }}>scan</span>}
            {p.pending
              ? <span className="t-caption">@{p.author?.handle} · publicando…</span>
              : <a href={`/post/${p.id}`} className="t-caption hover:opacity-70">@{p.author?.handle} · {timeAgo(p.createdAt)}</a>}
          </div>
          {body.trim() && <p className="mt-1.5 t-body whitespace-pre-wrap break-words">{tokenize(body)}</p>}
          {imgs.slice(0, 4).map((u) => (
            <a key={u} href={p.pending ? undefined : `/post/${p.id}`} className="media block mt-3"><img src={u} alt="" loading="lazy" className="max-h-[560px] w-full object-cover" /></a>
          ))}
          {!p.pending && (
            <PostActions postId={p.id} likes={p.likesCount || 0} comments={p.commentsCount || 0} liked={p.liked} saved={p.saved} logged={logged} />
          )}
        </div>
      </div>
    </article>
  )
}
export default PostCard
