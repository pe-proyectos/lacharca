import React, { useEffect, useRef, useState } from 'react'
import Composer from './Composer'
import PostCard, { type PostShape } from './PostCard'
import { getIdentity, getIdentityPage } from '../lib/hilosClient'

interface Props { user: { handle: string; displayName?: string | null; avatarUrl?: string | null; type?: string } }

// Envuelve el Composer y pinta arriba del feed SSR los posts recien creados,
// para que publicar sea instantaneo en vez de recargar la pagina.
const FeedComposer: React.FC<Props> = ({ user }) => {
  const [fresh, setFresh] = useState<PostShape[]>([])
  const box = useRef<HTMLDivElement>(null)

  // Si estás actuando como un scan, el compositor tiene que enseñar ESA cara:
  // ver tu avatar y publicar como otro es la receta para equivocarse.
  const [comoScan, setComoScan] = useState<Props['user'] | null>(null)
  useEffect(() => {
    const leer = () => {
      const handle = getIdentity()
      if (!handle) { setComoScan(null); return }
      const p = getIdentityPage()
      setComoScan({ handle, displayName: p?.displayName ?? handle, avatarUrl: p?.avatarUrl ?? null, type: 'scan' } as any)
    }
    leer()
    const on = () => leer()
    window.addEventListener('lc:identity', on)
    return () => window.removeEventListener('lc:identity', on)
  }, [])

  const identidad = comoScan || user

  // El boton "Publicar" de la nav abre el inicio con ?compose=1: enfocamos aqui.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('compose') !== '1') return
    const ta = box.current?.querySelector('textarea')
    if (ta) { (ta as HTMLTextAreaElement).focus(); ta.scrollIntoView({ block: 'center', behavior: 'smooth' }) }
  }, [])

  const author = {
    handle: identidad.handle,
    displayName: identidad.displayName,
    avatarUrl: identidad.avatarUrl,
    type: comoScan ? 'scan' : 'user',
  }

  return (
    <div>
      <div ref={box} className="pb-6 mb-2" style={{ borderBottom: '1px solid var(--line)' }}>
        {comoScan && (
          <p className="t-caption mb-2 inline-flex items-center gap-1.5">
            Publicando como <b style={{ color: 'var(--ink)' }}>{comoScan.displayName || `@${comoScan.handle}`}</b>
          </p>
        )}
        <Composer
          user={identidad}
          onOptimistic={(tempId, content) => setFresh((l) => [{ id: tempId, content, createdAt: new Date().toISOString(), author, pending: true }, ...l])}
          onPosted={(tempId, post) => setFresh((l) => l.map((p) => (p.id === tempId ? { ...post, author: post.author || author } : p)))}
          onFailed={(tempId) => setFresh((l) => l.filter((p) => p.id !== tempId))}
        />
      </div>
      {fresh.map((p) => <PostCard key={p.id} post={p} logged />)}
    </div>
  )
}
export default FeedComposer
