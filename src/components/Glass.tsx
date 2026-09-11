import React from 'react'
import LiquidGlass from 'liquid-glass-react'

/** Botón Liquid Glass (Apple). Refracción real + elasticidad al hover. */
export const GlassButton: React.FC<{
  children: React.ReactNode
  onClick?: () => void
  href?: string
  size?: 'sm' | 'md' | 'lg'
  tint?: boolean
  className?: string
}> = ({ children, onClick, href, size = 'md', tint, className = '' }) => {
  const pad = size === 'sm' ? '8px 16px' : size === 'lg' ? '16px 32px' : '12px 24px'
  const text = size === 'sm' ? 'text-[14px]' : size === 'lg' ? 'text-[18px]' : 'text-[15px]'
  const inner = (
    <span className={`${text} font-medium tracking-[-0.01em] whitespace-nowrap ${tint ? 'text-white' : 'text-white/95'}`}>
      {children}
    </span>
  )
  const glass = (
    <span className="relative inline-flex isolate" style={{ position: 'relative' }}>
    <LiquidGlass
      cornerRadius={999}
      padding={pad}
      displacementScale={64}
      blurAmount={0.12}
      saturation={140}
      aberrationIntensity={2}
      elasticity={0.28}
      mode="standard"
      onClick={onClick}
      className={className}
      style={{
        position: 'relative', top: 'auto', left: 'auto', transform: 'none',
        ...(tint ? { boxShadow: '0 8px 32px -8px rgba(10,200,255,.45)' } : {}),
      }}
    >
      {inner}
    </LiquidGlass>
    </span>
  )
  if (href) return <a href={href} className="inline-block no-underline">{glass}</a>
  return glass
}

/** Tarjeta/superficie de vidrio (sin displacement, más liviana para listas). */
export const GlassCard: React.FC<{ children: React.ReactNode; className?: string; radius?: number }> = ({ children, className = '', radius = 28 }) => (
  <div
    className={`relative overflow-hidden ${className}`}
    style={{
      borderRadius: radius,
      background: 'rgba(255,255,255,0.055)',
      backdropFilter: 'blur(28px) saturate(180%)',
      WebkitBackdropFilter: 'blur(28px) saturate(180%)',
      border: '1px solid rgba(255,255,255,0.11)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.24), inset 0 -1px 0 rgba(0,0,0,.18), 0 20px 60px -24px rgba(0,0,0,.8)',
    }}
  >
    {children}
  </div>
)
