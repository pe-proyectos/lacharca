import React, { useEffect, useState } from 'react'

// Barra de progreso durante las transiciones de vista: el usuario ve que algo
// está pasando en vez de quedarse mirando la pantalla anterior.
const NavProgress: React.FC = () => {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const start = () => setActive(true)
    const end = () => setActive(false)
    document.addEventListener('astro:before-preparation', start)
    document.addEventListener('astro:after-swap', end)
    document.addEventListener('astro:page-load', end)
    return () => {
      document.removeEventListener('astro:before-preparation', start)
      document.removeEventListener('astro:after-swap', end)
      document.removeEventListener('astro:page-load', end)
    }
  }, [])

  if (!active) return null
  return (
    <div className="fixed top-0 inset-x-0 z-[60] h-[3px] overflow-hidden" role="status" aria-label="Cargando">
      <div className="h-full" style={{ width: '40%', background: 'var(--blue)', animation: 'navbar-slide 1s ease-in-out infinite' }} />
    </div>
  )
}
export default NavProgress
