import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ChatCircleDots, X, PaperPlaneTilt, CaretLeft, LockSimple, MagnifyingGlass } from '@phosphor-icons/react'
import { hilosApi } from '../lib/hilosClient'
import { timeAgo } from '../lib/time'
import FollowButton from './FollowButton'

interface Page {
  handle: string; displayName?: string | null; avatarUrl?: string | null; type?: string
  bio?: string | null; followersCount?: number; followingCount?: number; postsCount?: number
}
const n = (v: any) => Number(v || 0).toLocaleString('es')
interface Conv { id: number; page: Page; canRead: boolean; unread: number; lastMessageAt: string; lastMessage: { content: string; createdAt: string; mine: boolean } | null }
interface Msg { id: number; content: string; createdAt: string; mine: boolean; pending?: boolean }

const POLL_OPEN = 5000     // conversación abierta: casi en vivo
const POLL_IDLE = 30000    // cerrado: solo para el contador

const Avatar = ({ p, size = 40 }: { p: Page; size?: number }) =>
  p?.avatarUrl
    ? <img src={p.avatarUrl} alt="" style={{ width: size, height: size }} className={`object-cover shrink-0 ${p.type === 'user' ? 'rounded-full' : 'rounded-xl'}`} />
    : <span style={{ width: size, height: size, background: 'var(--soft)', color: 'var(--blue)' }}
        className={`grid place-items-center shrink-0 text-[14px] font-semibold ${p.type === 'user' ? 'rounded-full' : 'rounded-xl'}`}>
        {(p?.displayName || p?.handle || '?')[0]?.toUpperCase()}
      </span>

// Mensajeria flotante, visible en toda la plataforma. Solo puedes escribir a
// quien sigues, y solo lees a quien sigues: la regla la aplica hilos.rest, aqui
// nada mas la explicamos.
const ChatDock: React.FC<{ me: string }> = ({ me }) => {
  const [open, setOpen] = useState(false)
  const [convs, setConvs] = useState<Conv[] | null>(null)
  const [active, setActive] = useState<Conv | null>(null)
  const [msgs, setMsgs] = useState<Msg[] | null>(null)
  const [canWrite, setCanWrite] = useState(true)
  const [text, setText] = useState('')
  const [unread, setUnread] = useState(0)
  const [q, setQ] = useState('')
  const [lockedPage, setLockedPage] = useState<Page | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const lastSeen = useRef<string | null>(null)

  const loadConvs = useCallback(async () => {
    try { const d = await hilosApi.conversations(); setConvs(d?.items || []) } catch { setConvs([]) }
  }, [])

  const loadMsgs = useCallback(async (conv: Conv, silent = false) => {
    if (!silent) setMsgs(null)
    try {
      const d = await hilosApi.messages(conv.id)
      setMsgs(d?.items || [])
      setCanWrite(!!d?.canWrite)
    } catch { if (!silent) setMsgs([]) }
  }, [])

  // Contador de no leidos: sondeo suave incluso con el chat cerrado.
  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const d = await hilosApi.unread()
        if (!alive) return
        setUnread(d?.total || 0)
        // Si hubo movimiento y la lista esta abierta, la refrescamos.
        if (d?.lastMessageAt && d.lastMessageAt !== lastSeen.current) {
          lastSeen.current = d.lastMessageAt
          if (open && !active) loadConvs()
        }
      } catch { /* sin sesion o sin red */ }
    }
    tick()
    const id = setInterval(tick, open ? POLL_OPEN : POLL_IDLE)
    return () => { alive = false; clearInterval(id) }
  }, [open, active, loadConvs])

  // Conversacion abierta: refresco frecuente para que se sienta en vivo.
  useEffect(() => {
    if (!open || !active || !active.canRead) return
    const id = setInterval(() => loadMsgs(active, true), POLL_OPEN)
    return () => clearInterval(id)
  }, [open, active, loadMsgs])

  useEffect(() => { if (open && !convs) loadConvs() }, [open, convs, loadConvs])
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }) }, [msgs])

  // Otras vistas pueden abrir un chat concreto: window.dispatchEvent(new CustomEvent('lc:chat', { detail: { handle } }))
  useEffect(() => {
    const onOpen = async (e: any) => {
      const handle = e?.detail?.handle
      setOpen(true)
      if (!handle) return
      const d = await hilosApi.conversations().catch(() => null)
      const list: Conv[] = d?.items || []
      setConvs(list)
      const found = list.find((c) => c.page.handle === handle)
      if (found) { setActive(found); loadMsgs(found); return }
      // Conversación todavía inexistente: abrimos un hilo en blanco.
      const page = await hilosApi.page(handle).catch(() => null)
      if (page) {
        const fresh: Conv = { id: -1, page, canRead: true, unread: 0, lastMessageAt: new Date().toISOString(), lastMessage: null }
        setActive(fresh); setMsgs([]); setCanWrite(true)
      }
    }
    window.addEventListener('lc:chat', onOpen as any)
    return () => window.removeEventListener('lc:chat', onOpen as any)
  }, [loadMsgs])

  const send = async () => {
    const body = text.trim()
    if (!body || !active) return
    const tempId = -Date.now()
    setMsgs((l) => [...(l || []), { id: tempId, content: body, createdAt: new Date().toISOString(), mine: true, pending: true }])
    setText('')
    try {
      const m = await hilosApi.send(active.page.handle, body)
      setMsgs((l) => (l || []).map((x) => (x.id === tempId ? { ...m, mine: true } : x)))
      if (active.id === -1 && m?.conversationId) setActive({ ...active, id: m.conversationId })
      loadConvs()
    } catch (e: any) {
      setMsgs((l) => (l || []).filter((x) => x.id !== tempId))
      setText(body)
      setCanWrite(e?.message !== 'must_follow_first')
    }
  }

  const openConv = async (c: Conv) => {
    setActive(c)
    setLockedPage(null)
    if (c.canRead) { loadMsgs(c) }
    else {
      setMsgs([]); setCanWrite(false)
      // Para decidir si seguir a alguien hay que poder verlo: traemos su ficha.
      const full = await hilosApi.page(c.page.handle).catch(() => null)
      setLockedPage(full || c.page)
    }
    setUnread((x) => Math.max(0, x - c.unread))
  }

  // Al seguir desde el chat, la conversación se desbloquea sin salir de aquí.
  const onFollowed = async (following: boolean) => {
    if (!following || !active) return
    const updated = { ...active, canRead: true }
    setActive(updated)
    setCanWrite(true)
    await loadMsgs(updated)
    loadConvs()
  }

  const shown = (convs || []).filter((c) => {
    if (!q.trim()) return true
    const t = `${c.page.displayName || ''} ${c.page.handle}`.toLowerCase()
    return t.includes(q.trim().toLowerCase())
  })

  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} aria-label="Mensajes"
          className="fixed z-40 right-4 md:right-5 rounded-full flex items-center gap-2 px-4 py-3 cursor-pointer transition hover:-translate-y-0.5 tap"
          style={{
            background: 'var(--blue)', color: '#fff', boxShadow: '0 8px 28px rgba(37,99,235,.35)',
            bottom: 'var(--dock-bottom)', minHeight: 52,
          }}>
          <ChatCircleDots size={20} weight="fill" />
          <span className="text-[14px] font-medium hidden sm:block">Mensajes</span>
          {unread > 0 && (
            <span className="grid place-items-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold tabular-nums"
              style={{ background: 'var(--surface)', color: 'var(--blue)' }}>{unread > 99 ? '99+' : unread}</span>
          )}
        </button>
      )}

      {open && (
        <div className="fixed z-[55] inset-x-0 bottom-0 md:inset-x-auto md:bottom-6 md:right-5 w-full md:w-[380px] flex flex-col rounded-t-3xl md:rounded-3xl overflow-hidden"
          style={{
            background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: '0 16px 48px var(--shadow)',
            height: 'min(86dvh, 560px)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}>
          <div className="md:hidden pt-2.5 pb-1 flex justify-center shrink-0" aria-hidden>
            <span className="block w-10 h-1 rounded-full" style={{ background: 'var(--line)' }} />
          </div>
          <header className="flex items-center gap-2 px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--line)' }}>
            {active ? (
              <>
                <button type="button" onClick={() => { setActive(null); setMsgs(null); loadConvs() }} className="act" aria-label="Volver"><CaretLeft size={18} /></button>
                <a href={`/@${active.page.handle}`} className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Avatar p={active.page} size={32} />
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium truncate">{active.page.displayName || active.page.handle}</span>
                    <span className="block t-caption truncate">@{active.page.handle}</span>
                  </span>
                </a>
              </>
            ) : (
              <h2 className="t-section flex-1">Mensajes</h2>
            )}
            <button type="button" onClick={() => setOpen(false)} className="act" aria-label="Cerrar"><X size={18} /></button>
          </header>

          {!active ? (
            <>
              <div className="px-4 py-2.5 shrink-0" style={{ borderBottom: '1px solid var(--line)' }}>
                <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--surface-2)' }}>
                  <MagnifyingGlass size={16} className="ink-3" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar conversación"
                    className="flex-1 bg-transparent text-[14px] focus:outline-none" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {convs === null ? (
                  <div className="p-4 space-y-4">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="skeleton rounded-full" style={{ width: 40, height: 40 }} />
                        <div className="flex-1 space-y-2">
                          <div className="skeleton h-3 w-1/3 rounded" />
                          <div className="skeleton h-3 w-2/3 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : shown.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <ChatCircleDots size={30} className="ink-3 mx-auto mb-3" />
                    <p className="t-body ink-2">Todavía no tienes mensajes.</p>
                    <p className="t-sub mt-1">Sigue a alguien y escríbele desde su perfil.</p>
                  </div>
                ) : shown.map((c) => (
                  <button key={c.id} type="button" onClick={() => openConv(c)}
                    className="row w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer">
                    <Avatar p={c.page} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[15px] font-medium truncate">{c.page.displayName || c.page.handle}</span>
                        <span className="t-caption shrink-0">{timeAgo(c.lastMessageAt)}</span>
                      </span>
                      <span className="flex items-center gap-1.5 t-caption truncate">
                        {c.canRead
                          ? (c.lastMessage ? `${c.lastMessage.mine ? 'Tú: ' : ''}${c.lastMessage.content}` : 'Sin mensajes')
                          : <><LockSimple size={12} /> Te escribió. Síguelo para leerlo.</>}
                      </span>
                    </span>
                    {c.unread > 0 && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--blue)' }} />}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
                {msgs === null ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((i) => <div key={i} className={`skeleton h-9 rounded-2xl ${i % 2 ? 'w-2/5 ml-auto' : 'w-3/5'}`} />)}
                  </div>
                ) : !active.canRead ? (
                  <div className="py-2">
                    {/* Resumen del perfil: lo justo para decidir si seguir. */}
                    <div className="rounded-2xl p-4 text-center" style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}>
                      <a href={`/@${active.page.handle}`} className="inline-block">
                        <Avatar p={lockedPage || active.page} size={64} />
                      </a>
                      <a href={`/@${active.page.handle}`} className="block text-[16px] font-semibold mt-2.5 hover:opacity-70 truncate">
                        {(lockedPage || active.page).displayName || active.page.handle}
                      </a>
                      <span className="block t-caption">@{active.page.handle}</span>

                      {lockedPage === null ? (
                        <div className="mt-3 space-y-2">
                          <div className="skeleton h-3 w-3/4 mx-auto rounded" />
                          <div className="skeleton h-3 w-1/2 mx-auto rounded" />
                        </div>
                      ) : (
                        <>
                          {lockedPage.bio && <p className="t-sub mt-2.5 line-clamp-3" style={{ color: 'var(--ink-2)' }}>{lockedPage.bio}</p>}
                          <div className="flex items-center justify-center gap-4 mt-3 text-[13px]">
                            <a href={`/@${lockedPage.handle}/seguidores`} className="hover:opacity-70">
                              <b className="font-semibold tabular-nums">{n(lockedPage.followersCount)}</b> <span className="ink-2">seguidores</span>
                            </a>
                            <a href={`/@${lockedPage.handle}/siguiendo`} className="hover:opacity-70">
                              <b className="font-semibold tabular-nums">{n(lockedPage.followingCount)}</b> <span className="ink-2">siguiendo</span>
                            </a>
                          </div>
                          <p className="t-caption mt-1">{n(lockedPage.postsCount)} publicaciones</p>
                        </>
                      )}

                      <div className="mt-4 flex items-center justify-center gap-2.5">
                        <FollowButton handle={active.page.handle} logged followers={lockedPage?.followersCount || 0} onChange={onFollowed} />
                        <a href={`/@${active.page.handle}`} className="chip">Ver perfil</a>
                      </div>
                    </div>

                    <p className="t-sub text-center mt-4 px-4 inline-flex items-center justify-center gap-1.5 w-full">
                      <LockSimple size={14} /> Sigue a @{active.page.handle} para leer sus mensajes y responder.
                    </p>
                  </div>
                ) : msgs.length === 0 ? (
                  <p className="t-sub text-center py-10">Escribe el primer mensaje.</p>
                ) : msgs.map((m) => (
                  <div key={m.id} className={`max-w-[78%] px-3.5 py-2 rounded-2xl text-[15px] leading-snug whitespace-pre-wrap break-words ${m.mine ? 'ml-auto' : ''}`}
                    style={m.mine
                      ? { background: 'var(--blue)', color: '#fff', opacity: m.pending ? 0.6 : 1 }
                      : { background: 'var(--surface-3)', color: 'var(--ink)' }}>
                    {m.content}
                  </div>
                ))}
              </div>

              {active.canRead && (
                <div className="shrink-0 px-3 py-3 flex items-end gap-2" style={{ borderTop: '1px solid var(--line)' }}>
                  {canWrite ? (
                    <>
                      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                        placeholder="Escribe un mensaje"
                        className="flex-1 resize-none rounded-2xl px-3.5 py-2.5 text-[15px] focus:outline-none"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', maxHeight: 96 }} />
                      <button type="button" onClick={send} disabled={!text.trim()} aria-label="Enviar"
                        className="grid place-items-center w-10 h-10 rounded-full shrink-0 disabled:opacity-35 cursor-pointer"
                        style={{ background: 'var(--blue)', color: '#fff' }}>
                        <PaperPlaneTilt size={17} weight="fill" />
                      </button>
                    </>
                  ) : (
                    <p className="t-caption flex-1 text-center py-2">Sigue a @{active.page.handle} para escribirle.</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}
export default ChatDock
