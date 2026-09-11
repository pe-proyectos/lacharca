import React, { useRef, useState } from 'react'
import { Camera, FloppyDisk, X } from '@phosphor-icons/react'
import { hilosApi, uploadToHilos } from '../lib/hilosClient'

interface Props {
  handle: string
  displayName: string
  bio: string
  avatarUrl: string | null
  bannerUrl: string | null
}

// Editor del propio perfil: foto, portada, nombre y biografia. Todo optimista;
// si el servidor rechaza algo se revierte y se explica por que.
const ProfileEditor: React.FC<Props> = (props) => {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(props.displayName || '')
  const [bio, setBio] = useState(props.bio || '')
  const [avatar, setAvatar] = useState(props.avatarUrl)
  const [banner, setBanner] = useState(props.bannerUrl)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState<'avatar' | 'banner' | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const avatarInput = useRef<HTMLInputElement>(null)
  const bannerInput = useRef<HTMLInputElement>(null)

  const pick = async (file: File | undefined, kind: 'avatar' | 'banner') => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setErr('Elige una imagen.'); return }
    if (file.size > 5 * 1024 * 1024) { setErr('La imagen no puede pesar más de 5 MB.'); return }
    setErr(null); setUploading(kind)
    try {
      const url = await uploadToHilos(file)
      if (kind === 'avatar') setAvatar(url); else setBanner(url)
    } catch { setErr('No se pudo subir la imagen.') } finally { setUploading(null) }
  }

  const save = async () => {
    setBusy(true); setErr(null)
    try {
      await hilosApi.updateProfile(props.handle, {
        displayName: name.trim(),
        bio: bio.trim(),
        avatarUrl: avatar,
        bannerUrl: banner,
      })
      window.location.reload()
    } catch (e: any) {
      setErr(e?.message === 'forbidden' ? 'No puedes editar este perfil.' : 'No se pudieron guardar los cambios.')
      setBusy(false)
    }
  }

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="chip cursor-pointer">Editar perfil</button>
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(16,31,56,.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) setOpen(false) }}>
      <div className="w-full max-w-[520px] rounded-3xl overflow-hidden rise" style={{ background: '#fff', border: '1px solid var(--line)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--line)' }}>
          <h2 className="t-section">Editar perfil</h2>
          <button type="button" onClick={() => !busy && setOpen(false)} className="act" aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          <button type="button" onClick={() => bannerInput.current?.click()}
            className="relative block w-full h-32 cursor-pointer group"
            style={{ background: banner ? `center/cover url(${banner})` : '#dbe8fb' }}>
            <span className="absolute inset-0 grid place-items-center transition" style={{ background: 'rgba(16,31,56,.35)' }}>
              <Camera size={22} color="#fff" weight="fill" />
            </span>
            {uploading === 'banner' && <span className="absolute inset-0 skeleton" />}
          </button>

          <div className="px-5 pb-5">
            <button type="button" onClick={() => avatarInput.current?.click()}
              className="relative -mt-10 mb-4 block rounded-full overflow-hidden cursor-pointer"
              style={{ width: 84, height: 84, border: '3px solid #fff', background: '#dbe8fb' }}>
              {avatar
                ? <img src={avatar} alt="" className="w-full h-full object-cover" />
                : <span className="grid place-items-center w-full h-full text-2xl font-semibold" style={{ color: 'var(--blue)' }}>{(name || props.handle)[0]?.toUpperCase()}</span>}
              <span className="absolute inset-0 grid place-items-center" style={{ background: 'rgba(16,31,56,.3)' }}>
                <Camera size={18} color="#fff" weight="fill" />
              </span>
              {uploading === 'avatar' && <span className="absolute inset-0 skeleton" />}
            </button>

            <input ref={avatarInput} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0], 'avatar')} />
            <input ref={bannerInput} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0], 'banner')} />

            <label className="eyebrow block mb-2">Nombre visible</label>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200}
              className="w-full rounded-xl px-3.5 py-3 text-[16px] focus:outline-none mb-4"
              style={{ background: '#fff', border: '1px solid var(--line)' }} />

            <label className="eyebrow block mb-2">Biografía</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={600} rows={4}
              placeholder="Cuenta algo sobre ti, qué lees, qué traduces..."
              className="w-full rounded-xl px-3.5 py-3 text-[16px] resize-none focus:outline-none"
              style={{ background: '#fff', border: '1px solid var(--line)' }} />
            <p className="t-caption mt-1.5 text-right tabular-nums">{600 - bio.length}</p>

            {err && <p className="t-caption mt-2" style={{ color: '#b42318' }}>{err}</p>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4" style={{ borderTop: '1px solid var(--line)' }}>
          <button type="button" onClick={() => setOpen(false)} disabled={busy} className="chip cursor-pointer">Cancelar</button>
          <button type="button" onClick={save} disabled={busy || !!uploading}
            className="btn inline-flex items-center gap-2 disabled:opacity-40 cursor-pointer">
            <FloppyDisk size={16} weight="fill" />{busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
export default ProfileEditor
