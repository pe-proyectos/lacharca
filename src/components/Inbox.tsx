import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChatCircleDots, PaperPlaneTilt, MagnifyingGlass, Archive, ArrowCounterClockwise,
  LockSimple, CaretLeft, PencilSimpleLine, X,
} from '@phosphor-icons/react'
import { hilosApi, getIdentity } from '../lib/hilosClient'
import { timeAgo } from '../lib/time'

interface Page { handle: string; displayName?: string | null; avatarUrl?: string | null; type?: string }
interface Conv {
  id: number; page: Page; canRead: boolean; unread: number; archived?: boolean
  lastMessageAt: string; lastMessage: { content: string; createdAt: string; mine: boolean } | null
}
interface Msg { id: number; content: string; createdAt: string; mine: boolean; pending?: boolean }

const POLL = 6000

const Avatar = ({ p, size = 44 }: { p: Page; size?: number }) =>
  p?.avatarUrl
    ? <img src={p.avatarUrl} alt="" style={{ width: size, height: size }} className={`object-cover shrink-0 ${p.type === 'user' ? 'rounded-full' : 'rounded-xl'}`} />
    : <span style={{ width: size, height: size, background: 'var(--soft)', color: 'var(--blue)' }}
        className={`grid place-items-center shrink-0 text-[15px] font-semibold ${p.type === 'user' ? 'rounded-full' : 'rounded-xl'}`}>
        {(p?.displayName || p?.handle || '?')[0]?.toUpperCase()}
      </span>

// Bandeja a pantalla completa. La conversación abierta vive en la URL
// (/mensajes/@handle), para que un enlace se pueda pasar a otro miembro del
// equipo y le abra exactamente lo mismo.
const Inbox: React.FC<{ me: string; initialHandle?: string | null }> = ({ me, initialHandle }) => {
  const [convs, setConvs] = useState<Conv[] | null>(null)
  const [archivadas, setArchivadas] = useState(false)
  const [activa, setActiva] = useState<Conv | null>(null)
  const [msgs, setMsgs] = useState<Msg[] | null>(null)
  const [canWrite, setCanWrite] = useState(true)
  const [texto, setTexto] = useState('')
  const [busca, setBusca] = useState('')
  const [nuevo, setNuevo] = useState(false)
  const [candidatos, setCandidatos] = useState<Page[]>([])
  const [buscando, setBuscando] = useState(false)
  const lista = useRef<HTMLDivElement>(null)
  const identidad = getIdentity()

  const cargar = useCallback(async (arch = archivadas) => {
    try {
      const d = await hilosApi.conversations(0, arch)
      setConvs(d?.items || [])
      return d?.items || []
    } catch { setConvs([]); return [] }
  }, [archivadas])

  const abrir = useCallback(async (c: Conv, push = true) => {
    setActiva(c)
    setNuevo(false)
    if (push) history.pushState({}, '', `/mensajes/@${c.page.handle}`)
    if (!c.canRead) { setMsgs([]); setCanWrite(false); return }
    setMsgs(null)
    try {
      const d = await hilosApi.messages(c.id)
      setMsgs(d?.items || [])
      setCanWrite(!!d?.canWrite)
    } catch { setMsgs([]) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Abrir la conversación que venga en la URL.
  useEffect(() => {
    if (!initialHandle || !convs) return
    const c = convs.find((x) => x.page.handle === initialHandle)
    if (c) { abrir(c, false); return }
    // Aún no hay conversación con esa persona: preparamos una en blanco.
    hilosApi.page(initialHandle).then((p: Page) => {
      if (p) { setActiva({ id: -1, page: p, canRead: true, unread: 0, lastMessageAt: new Date().toISOString(), lastMessage: null }); setMsgs([]); setCanWrite(true) }
    }).catch(() => {})
  }, [initialHandle, convs, abrir])

  // Volver atrás en el navegador cierra la conversación.
  useEffect(() => {
    const onPop = () => {
      const m = location.pathname.match(/^\/mensajes\/@([^/]+)/)
      if (!m) { setActiva(null); setMsgs(null); return }
      const c = (convs || []).find((x) => x.page.handle === m[1])
      if (c) abrir(c, false)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [convs, abrir])

  // Refresco de la conversación abierta: así se siente vivo sin recargar.
  useEffect(() => {
    if (!activa || !activa.canRead || activa.id < 0) return
    const id = setInterval(async () => {
      try {
        const d = await hilosApi.messages(activa.id)
        setMsgs(d?.items || [])
      } catch {}
    }, POLL)
    return () => clearInterval(id)
  }, [activa])

  useEffect(() => { lista.current?.scrollTo({ top: lista.current.scrollHeight }) }, [msgs])

  // Autocompletado al empezar un chat nuevo.
  useEffect(() => {
    if (!nuevo) return
    const q = busca.trim().replace(/^@/, '')
    if (q.length < 2) { setCandidatos([]); return }
    setBuscando(true)
    const t = setTimeout(async () => {
      try {
        const d = await hilosApi.buscarPages(q)
        setCandidatos((d?.items || []).filter((p: Page) => p.handle !== me))
      } catch { setCandidatos([]) } finally { setBuscando(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [busca, nuevo, me])

  const enviar = async () => {
    const cuerpo = texto.trim()
    if (!cuerpo || !activa) return
    const tempId = -Date.now()
    setMsgs((l) => [...(l || []), { id: tempId, content: cuerpo, createdAt: new Date().toISOString(), mine: true, pending: true }])
    setTexto('')
    try {
      const m = await hilosApi.send(activa.page.handle, cuerpo)
      setMsgs((l) => (l || []).map((x) => (x.id === tempId ? { ...m, mine: true } : x)))
      if (activa.id < 0 && m?.conversationId) setActiva({ ...activa, id: m.conversationId })
      cargar()
    } catch (e: any) {
      setMsgs((l) => (l || []).filter((x) => x.id !== tempId))
      setTexto(cuerpo)
      if (e?.message === 'must_follow_first') setCanWrite(false)
    }
  }

  const archivar = async (c: Conv, valor: boolean) => {
    setConvs((l) => (l || []).filter((x) => x.id !== c.id))
    if (activa?.id === c.id) { setActiva(null); history.pushState({}, '', '/mensajes') }
    try { await hilosApi.archive(c.id, valor) } catch { cargar() }
  }

  const empezarCon = async (p: Page) => {
    setNuevo(false); setBusca(''); setCandidatos([])
    const existente = (convs || []).find((c) => c.page.handle === p.handle)
    if (existente) return abrir(existente)
    setActiva({ id: -1, page: p, canRead: true, unread: 0, lastMessageAt: new Date().toISOString(), lastMessage: null })
    setMsgs([]); setCanWrite(true)
    history.pushState({}, '', `/mensajes/@${p.handle}`)
  }

  const filtradas = (convs || []).filter((c) => {
    if (!busca.trim() || nuevo) return true
    const t = `${c.page.displayName || ''} ${c.page.handle}`.toLowerCase()
    return t.includes(busca.trim().toLowerCase())
  })

  return (
    <div className="flex rounded-2xl overflow-hidden" style={{ border: '1px solid var(--line)', height: 'calc(100dvh - 190px)', minHeight: 420 }}>
      {/* Lista */}
      <aside className={`w-full md:w-[330px] shrink-0 flex flex-col ${activa ? 'hidden md:flex' : ''}`}
        style={{ borderRight: '1px solid var(--line)', background: 'var(--surface)' }}>
        <div className="p-3 shrink-0 space-y-2" style={{ borderBottom: '1px solid var(--line)' }}>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 flex-1" style={{ background: 'var(--surface-2)' }}>
              <MagnifyingGlass size={16} className="ink-3" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)}
                placeholder={nuevo ? 'Escribe un @usuario' : 'Buscar'}
                className="flex-1 bg-transparent text-[14px] focus:outline-none" />
              {busca && <button type="button" onClick={() => setBusca('')} className="ink-3" aria-label="Limpiar"><X size={14} /></button>}
            </div>
            <button type="button" onClick={() => { setNuevo((v) => !v); setBusca('') }}
              className="icon-btn shrink-0" title="Nuevo mensaje" aria-label="Nuevo mensaje"
              style={nuevo ? { background: 'var(--soft)', color: 'var(--blue)' } : undefined}>
              <PencilSimpleLine size={18} />
            </button>
          </div>

          {!nuevo && (
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => { setArchivadas(false); cargar(false) }}
                className={`chip cursor-pointer ${!archivadas ? 'is-on' : ''}`} style={{ padding: '5px 12px', fontSize: 13, minHeight: 0 }}>Activos</button>
              <button type="button" onClick={() => { setArchivadas(true); cargar(true) }}
                className={`chip cursor-pointer ${archivadas ? 'is-on' : ''}`} style={{ padding: '5px 12px', fontSize: 13, minHeight: 0 }}>Archivados</button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {nuevo ? (
            <div className="py-2">
              {busca.trim().length < 2 ? (
                <p className="t-sub text-center py-10 px-6">Escribe al menos dos letras del @usuario.</p>
              ) : buscando ? (
                <div className="p-3 space-y-3">{[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="skeleton rounded-full" style={{ width: 40, height: 40 }} />
                    <div className="skeleton h-3 w-1/2 rounded" />
                  </div>))}
                </div>
              ) : candidatos.length === 0 ? (
                <p className="t-sub text-center py-10 px-6">Nadie coincide con eso.</p>
              ) : candidatos.map((p) => (
                <button key={p.handle} type="button" onClick={() => empezarCon(p)}
                  className="row w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer">
                  <Avatar p={p} size={40} />
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium truncate">{p.displayName || p.handle}</span>
                    <span className="block t-caption truncate">@{p.handle}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : convs === null ? (
            <div className="p-3 space-y-4">{[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton rounded-full" style={{ width: 44, height: 44 }} />
                <div className="flex-1 space-y-2"><div className="skeleton h-3 w-1/3 rounded" /><div className="skeleton h-3 w-2/3 rounded" /></div>
              </div>))}
            </div>
          ) : filtradas.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <ChatCircleDots size={30} className="ink-3 mx-auto mb-3" />
              <p className="t-body ink-2">{archivadas ? 'No hay conversaciones archivadas.' : 'Todavía no hay mensajes.'}</p>
              {!archivadas && <p className="t-sub mt-1">Sigue a alguien y escríbele para empezar.</p>}
            </div>
          ) : filtradas.map((c) => (
            <div key={c.id} className={`row flex items-center gap-1 px-1 ${activa?.id === c.id ? 'is-active' : ''}`}
              style={activa?.id === c.id ? { background: 'var(--active)' } : undefined}>
              <button type="button" onClick={() => abrir(c)} className="flex items-center gap-3 px-2 py-3 flex-1 min-w-0 text-left cursor-pointer">
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
              <button type="button" onClick={() => archivar(c, !archivadas)}
                className="icon-btn shrink-0" style={{ width: 34, height: 34 }}
                title={archivadas ? 'Devolver a activos' : 'Archivar'} aria-label={archivadas ? 'Devolver a activos' : 'Archivar'}>
                {archivadas ? <ArrowCounterClockwise size={15} /> : <Archive size={15} />}
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Conversación */}
      <section className={`flex-1 min-w-0 flex flex-col ${activa ? '' : 'hidden md:flex'}`} style={{ background: 'var(--surface)' }}>
        {!activa ? (
          <div className="flex-1 grid place-items-center px-8 text-center">
            <div>
              <ChatCircleDots size={38} className="ink-3 mx-auto mb-4" />
              <p className="t-body ink-2">Elige una conversación</p>
              <p className="t-sub mt-1">
                {identidad ? `Estás viendo la bandeja de @${identidad}.` : 'O empieza una nueva con el lápiz.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-2.5 px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--line)' }}>
              <button type="button" onClick={() => { setActiva(null); history.pushState({}, '', '/mensajes') }}
                className="icon-btn md:hidden shrink-0" aria-label="Volver"><CaretLeft size={18} /></button>
              <a href={`/@${activa.page.handle}`} className="flex items-center gap-2.5 min-w-0 flex-1">
                <Avatar p={activa.page} size={36} />
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium truncate">{activa.page.displayName || activa.page.handle}</span>
                  <span className="block t-caption truncate">@{activa.page.handle}</span>
                </span>
              </a>
              {activa.id > 0 && (
                <button type="button" onClick={() => archivar(activa, !activa.archived)} className="icon-btn shrink-0"
                  title="Archivar" aria-label="Archivar"><Archive size={17} /></button>
              )}
            </header>

            <div ref={lista} className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {msgs === null ? (
                <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className={`skeleton h-9 rounded-2xl ${i % 2 ? 'w-2/5 ml-auto' : 'w-3/5'}`} />)}</div>
              ) : !activa.canRead ? (
                <div className="px-4 py-12 text-center">
                  <LockSimple size={26} className="ink-3 mx-auto mb-3" />
                  <p className="t-body ink-2">@{activa.page.handle} escribió.</p>
                  <p className="t-sub mt-1">Para leer y responder hay que seguirlo primero.</p>
                  <a href={`/@${activa.page.handle}`} className="btn mt-5 inline-block">Ver su perfil</a>
                </div>
              ) : msgs.length === 0 ? (
                <p className="t-sub text-center py-10">Escribe el primer mensaje.</p>
              ) : msgs.map((m) => (
                <div key={m.id} className={`max-w-[74%] px-3.5 py-2 rounded-2xl text-[15px] leading-snug whitespace-pre-wrap break-words ${m.mine ? 'ml-auto' : ''}`}
                  style={m.mine
                    ? { background: 'var(--blue)', color: '#fff', opacity: m.pending ? 0.6 : 1 }
                    : { background: 'var(--surface-2)', color: 'var(--ink)' }}>
                  {m.content}
                </div>
              ))}
            </div>

            {activa.canRead && (
              <div className="shrink-0 px-3 py-3 flex items-end gap-2" style={{ borderTop: '1px solid var(--line)' }}>
                {canWrite ? (
                  <>
                    <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={1}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                      placeholder="Escribe un mensaje"
                      className="flex-1 resize-none rounded-2xl px-3.5 py-2.5 text-[15px] focus:outline-none"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', maxHeight: 120 }} />
                    <button type="button" onClick={enviar} disabled={!texto.trim()} aria-label="Enviar"
                      className="grid place-items-center w-10 h-10 rounded-full shrink-0 disabled:opacity-35 cursor-pointer"
                      style={{ background: 'var(--blue)', color: '#fff' }}>
                      <PaperPlaneTilt size={17} weight="fill" />
                    </button>
                  </>
                ) : (
                  <p className="t-caption flex-1 text-center py-2">Sigue a @{activa.page.handle} para escribirle.</p>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
export default Inbox
