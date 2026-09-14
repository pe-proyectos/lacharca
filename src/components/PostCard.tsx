import React from 'react'
import PostActions from './PostActions'
import { Poll, Reveal, Countdown, type PollData, type RevealData, type CountdownData } from './PostExtras'
import { timeAgo } from '../lib/time'
import { isMedia } from '../lib/media'

export interface WallPage { handle: string; type?: string; displayName?: string | null; avatarUrl?: string | null; parentHandle?: string | null }

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
  wall?: WallPage | null
  poll?: PollData | null
  reveal?: RevealData | null
  countdown?: CountdownData | null
}


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
const PostCard: React.FC<{ post: PostShape; logged: boolean; me?: string | null }> = ({ post: p, logged, me = null }) => {
  const imgs = (p.content || '').split(/\s+/).filter((w) => /^https?:\/\//.test(w) && isMedia(w))
  const body = (p.content || '').split('\n').filter((l) => !imgs.includes(l.trim())).join('\n')
  const name = p.author?.displayName || p.author?.handle || ''

  return (
    <article className="row py-6 rise" style={{ borderBottom: '1px solid var(--line)', opacity: p.pending ? 0.55 : 1 }}>
      <div className="flex gap-3.5">
        <a href={`/@${p.author?.handle}`} data-hover-handle={p.author?.handle} className="shrink-0">
          {p.author?.avatarUrl
            ? <img src={p.author.avatarUrl} alt="" className={`w-11 h-11 object-cover ${p.author.type === 'user' ? 'rounded-full' : 'rounded-xl'}`} />
            : <span className={`grid place-items-center w-11 h-11 font-semibold ${p.author?.type === 'user' ? 'rounded-full' : 'rounded-xl'}`} style={{ background: 'var(--soft)', color: 'var(--blue)' }}>{(name || '?')[0]?.toUpperCase()}</span>}
        </a>
        <div className="min-w-0 flex-1 max-w-[760px]">
          <div className="flex items-center gap-2 flex-wrap">
            <a href={`/@${p.author?.handle}`} data-hover-handle={p.author?.handle} className="text-[16px] font-semibold hover:opacity-70 truncate">{name}</a>
            {p.author?.type === 'scan' && <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: 'var(--soft-aqua)', color: 'var(--aqua)' }}>scan</span>}
            {p.pending
              ? <span className="t-caption">@{p.author?.handle} · publicando…</span>
              : <a href={`/post/${p.id}`} className="t-caption hover:opacity-70">@{p.author?.handle} · {timeAgo(p.createdAt)}</a>}
          </div>
          {body.trim() && <p className="mt-1.5 t-body whitespace-pre-wrap break-words">{tokenize(body)}</p>}
          {p.reveal?.locked && <Reveal data={p.reveal} />}
          {p.poll && <Poll postId={p.id} data={p.poll} logged={logged} />}
          {p.countdown && <Countdown data={p.countdown} />}

          {p.wall && p.wall.type === 'manga' && (
            <a href={p.wall.parentHandle ? `/@${p.wall.parentHandle}/${p.wall.handle}` : `/@${p.wall.handle}`} data-hover-handle={p.wall.handle}
              className="mt-2.5 flex items-center gap-3 p-2.5 rounded-2xl transition hover:opacity-85"
              style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}>
              {p.wall.avatarUrl
                ? <img src={p.wall.avatarUrl} alt="" width={44} height={44} loading="lazy" className="rounded-xl object-cover shrink-0" style={{ width: 44, height: 44 }} />
                : <span className="grid place-items-center rounded-xl text-[15px] font-semibold shrink-0" style={{ width: 44, height: 44, background: 'var(--soft)', color: 'var(--blue)' }}>{(p.wall.displayName || p.wall.handle)[0]?.toUpperCase()}</span>}
              <span className="min-w-0">
                <span className="block eyebrow">Obra</span>
                <span className="block text-[14px] font-medium truncate">{p.wall.displayName || p.wall.handle}</span>
              </span>
            </a>
          )}

          {imgs.length > 0 && (
            <div className={`mt-3 grid gap-2 ${imgs.length > 1 ? 'grid-cols-2' : ''}`}>
              {imgs.slice(0, 4).map((u) => (
                <span key={u} className={`media post-media ${imgs.length > 1 ? 'post-media--grid' : ''}`}
                  style={{ ['--media-bg' as any]: `url('${u}')` }}
                  data-lightbox="" data-lightbox-group={`post-${p.id}`} data-src={u}>
                  <img src={u} alt="Imagen de la publicación" loading="lazy" />
                </span>
              ))}
            </div>
          )}
          {!p.pending && (
            <PostActions postId={p.id} likes={p.likesCount || 0} comments={p.commentsCount || 0} liked={p.liked} saved={p.saved} logged={logged} authorHandle={p.author?.handle} me={me} />
          )}
        </div>
      </div>
    </article>
  )
}
export default PostCard
