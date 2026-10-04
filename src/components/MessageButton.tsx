import React, { useState } from 'react'
import { PaperPlaneTilt } from '@phosphor-icons/react'
import { useT } from '../i18n'
import cat from '../i18n/catalogos/mensajes'

// Abre el chat flotante en la conversación con esta persona. Solo se puede
// escribir a quien sigues: si aún no la sigues, lo decimos en vez de fallar.
const MessageButton: React.FC<{ handle: string; canMessage: boolean; compact?: boolean }> = ({ handle, canMessage, compact = false }) => {
  const t = useT(cat)
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
      title={following ? t('enviar_mensaje') : t('sigue_para_escribir', { handle })}
      className="chip inline-flex items-center gap-2 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
      style={compact ? { padding: '5px 12px', fontSize: 13, minHeight: 0 } : undefined}>
      <PaperPlaneTilt size={compact ? 14 : 16} weight="fill" />
      {t('mensaje')}
    </button>
  )
}
export default MessageButton
