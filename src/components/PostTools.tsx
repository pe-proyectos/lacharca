import React from 'react'
import { ChartBar, LockKey, Timer, X, Plus, Trash } from '@phosphor-icons/react'
import { useT } from '../i18n'
import cat from '../i18n/catalogos/composer'

export interface Encuesta { options: string[]; endsAt: string }
export interface Programado { at: string; placeholder: string }
export interface Cuenta { at: string; label: string }

interface Props {
  encuesta: Encuesta | null
  setEncuesta: (v: Encuesta | null) => void
  programado: Programado | null
  setProgramado: (v: Programado | null) => void
  cuenta: Cuenta | null
  setCuenta: (v: Cuenta | null) => void
}

const campo = {
  background: 'var(--surface-2)',
  border: '1px solid var(--line)',
} as React.CSSProperties

// Dentro de dos horas, como punto de partida razonable.
const enDosHoras = () => {
  const d = new Date(Date.now() + 2 * 3600_000)
  d.setSeconds(0, 0)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

const Bloque: React.FC<{ titulo: string; onClose: () => void; children: React.ReactNode }> = ({ titulo, onClose, children }) => {
  const t = useT(cat)
  return (
  <div className="rounded-2xl p-3.5 mt-3" style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}>
    <div className="flex items-center justify-between mb-2.5">
      <p className="eyebrow">{titulo}</p>
      <button type="button" onClick={onClose} className="icon-btn" style={{ width: 28, height: 28 }} aria-label={t('quitar')}><X size={14} /></button>
    </div>
    {children}
  </div>
  )
}

// Herramientas de publicación: encuesta, mensaje que se abre a una hora y
// cuenta atrás. Se añaden de una en una y se pueden quitar antes de publicar.
const PostTools: React.FC<Props> = ({ encuesta, setEncuesta, programado, setProgramado, cuenta, setCuenta }) => {
  const t = useT(cat)
  return (
  <>
    <div className="flex items-center gap-1">
      <button type="button" title={t('encuesta')} aria-label={t('anadir_encuesta')}
        onClick={() => setEncuesta(encuesta ? null : { options: ['', ''], endsAt: '' })}
        className="icon-btn" style={encuesta ? { background: 'var(--soft)', color: 'var(--blue)' } : undefined}>
        <ChartBar size={19} />
      </button>
      <button type="button" title={t('mensaje_programado')} aria-label={t('programar')}
        onClick={() => setProgramado(programado ? null : { at: enDosHoras(), placeholder: '' })}
        className="icon-btn" style={programado ? { background: 'var(--soft)', color: 'var(--blue)' } : undefined}>
        <LockKey size={19} />
      </button>
      <button type="button" title={t('cuenta_atras')} aria-label={t('anadir_cuenta')}
        onClick={() => setCuenta(cuenta ? null : { at: enDosHoras(), label: '' })}
        className="icon-btn" style={cuenta ? { background: 'var(--soft)', color: 'var(--blue)' } : undefined}>
        <Timer size={19} />
      </button>
    </div>

    {encuesta && (
      <Bloque titulo={t('encuesta')} onClose={() => setEncuesta(null)}>
        <div className="space-y-2">
          {encuesta.options.map((op, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={op} maxLength={80}
                onChange={(e) => {
                  const options = [...encuesta.options]
                  options[i] = e.target.value
                  setEncuesta({ ...encuesta, options })
                }}
                placeholder={t('opcion_n', { n: i + 1 })}
                className="flex-1 rounded-xl px-3 py-2 text-[15px] focus:outline-none" style={campo} />
              {encuesta.options.length > 2 && (
                <button type="button" onClick={() => setEncuesta({ ...encuesta, options: encuesta.options.filter((_, j) => j !== i) })}
                  className="icon-btn shrink-0" style={{ width: 34, height: 34 }} aria-label={t('quitar_opcion')}><Trash size={15} /></button>
              )}
            </div>
          ))}
        </div>
        {encuesta.options.length < 6 && (
          <button type="button" onClick={() => setEncuesta({ ...encuesta, options: [...encuesta.options, ''] })}
            className="chip mt-2.5 inline-flex items-center gap-1.5 cursor-pointer" style={{ padding: '5px 12px', fontSize: 13, minHeight: 0 }}>
            <Plus size={13} /> {t('otra_opcion')}
          </button>
        )}
        <label className="block eyebrow mt-3 mb-1.5">{t('cierra_el')}</label>
        <input type="datetime-local" value={encuesta.endsAt}
          onChange={(e) => setEncuesta({ ...encuesta, endsAt: e.target.value })}
          className="rounded-xl px-3 py-2 text-[14px] focus:outline-none" style={campo} />
      </Bloque>
    )}

    {programado && (
      <Bloque titulo={t('se_revela')} onClose={() => setProgramado(null)}>
        <input type="datetime-local" value={programado.at}
          onChange={(e) => setProgramado({ ...programado, at: e.target.value })}
          className="rounded-xl px-3 py-2 text-[14px] focus:outline-none" style={campo} />
        <input value={programado.placeholder} maxLength={120}
          onChange={(e) => setProgramado({ ...programado, placeholder: e.target.value })}
          placeholder={t('mientras_tanto')}
          className="w-full rounded-xl px-3 py-2 text-[15px] focus:outline-none mt-2" style={campo} />
        <p className="t-caption mt-2">
          {t('cifrado')}
        </p>
      </Bloque>
    )}

    {cuenta && (
      <Bloque titulo={t('cuenta_atras')} onClose={() => setCuenta(null)}>
        <input type="datetime-local" value={cuenta.at}
          onChange={(e) => setCuenta({ ...cuenta, at: e.target.value })}
          className="rounded-xl px-3 py-2 text-[14px] focus:outline-none" style={campo} />
        <input value={cuenta.label} maxLength={120}
          onChange={(e) => setCuenta({ ...cuenta, label: e.target.value })}
          placeholder={t('que_pasa')}
          className="w-full rounded-xl px-3 py-2 text-[15px] focus:outline-none mt-2" style={campo} />
      </Bloque>
    )}
  </>
  )
}
export default PostTools
