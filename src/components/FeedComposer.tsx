import React, { useEffect, useRef, useState } from 'react'
import Composer from './Composer'
import PostCard, { type PostShape } from './PostCard'

interface Props { user: { handle: string; displayName?: string | null; avatarUrl?: string | null; type?: string } }

// Envuelve el Composer y pinta arriba del feed SSR los posts recien creados,
// para que publicar sea instantaneo en vez de recargar la pagina.
const FeedComposer: React.FC<Props> = ({ user }) => {
  const [fresh, setFresh] = useState<PostShape[]>([])
  const box = useRef<HTMLDivElement>(null)

  // El boton "Publicar" de la nav abre el inicio con ?compose=1: enfocamos aqui.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('compose') !== '1') return
    const ta = box.current?.querySelector('textarea')
    if (ta) { (ta as HTMLTextAreaElement).focus(); ta.scrollIntoView({ block: 'center', behavior: 'smooth' }) }
  }, [])

  const author = { handle: user.handle, displayName: user.displayName, avatarUrl: user.avatarUrl, type: 'user' }

  return (
    <div>
      <div ref={box} className="pb-6 mb-2" style={{ borderBottom: '1px solid var(--line)' }}>
        <Composer
          user={user}
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
