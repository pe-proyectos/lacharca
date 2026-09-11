import React, { useState } from 'react'
import { PaperPlaneTilt } from '@phosphor-icons/react'

// Abre el chat flotante en la conversación con esta persona. Solo se puede
// escribir a quien sigues: si aún no la sigues, lo decimos en vez de fallar.
const MessageButton: React.FC<{ handle: string; canMessage: boolean }> = ({ handle, canMessage }) => {
  const [following, setFollowing] = useState(canMessage)

  // El botón de seguir avisa por evento para habilitarnos sin recargar.
  React.useEffect(() => {
    const on = (e: any) => { if (e?.detail?.handle === handle) setFollowing(!!e.detail.following) }
    window.addEventListener('lc:follow', on as any)
    return () => window.removeEventListener('lc:follow', on as any)
  }, [handle])

  return (
    <button type="button"
      onClick={() => window.dispatchEvent(new CustomEvent('lc:chat', { detail: { handle } }))}
      disabled={!following}
      title={following ? 'Enviar mensaje' : `Sigue a @${handle} para escribirle`}
      className="chip inline-flex items-center gap-2 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed">
      <PaperPlaneTilt size={16} weight="fill" />
      Mensaje
    </button>
  )
}
export default MessageButton
