import { describe, expect, test } from 'bun:test'
import { esDeCapibara, refrescoBase, planPerfil } from './perfil'

const viejo = 'https://r2.capibaratraductor.com/profile_pictures/1775314229767_637873.png'
const actual = 'https://r2.capibaratraductor.com/v2/profile_pictures/1775314229767_637873.webp'
const propio = 'https://r2.hilos.rest/1/media/123-abc-yo.webp'
const user = (o: any = {}) => ({ handle: 'vamos', displayName: 'Vamos', avatarUrl: viejo, bannerUrl: null, bio: null, ...o })
const page = (o: any = {}) => ({ handle: 'vamos', displayName: 'Vamos', avatarUrl: viejo, bannerUrl: null, bio: null, ...o })

describe('perfil', () => {
  test('reconoce copias de Capibara', () => {
    expect(esDeCapibara(viejo)).toBe(true)
    expect(esDeCapibara('https://files.capibaratraductor.com/x.png')).toBe(true)
    expect(esDeCapibara(propio)).toBe(false)
    expect(esDeCapibara(null)).toBe(false)
  })

  test('la base toma la foto actual de Capibara, no la copia guardada', () => {
    expect(refrescoBase(user(), { imageUrl: actual })).toEqual({ avatarUrl: actual })
    expect(refrescoBase(user({ avatarUrl: actual }), { imageUrl: actual })).toEqual({})
    // Foto propia en la base: no se pisa.
    expect(refrescoBase(user({ avatarUrl: propio }), { imageUrl: actual })).toEqual({})
  })

  test('login: page con copia rota -> foto actual en hilos y base', () => {
    const p = planPerfil(user({ avatarUrl: actual }), page(), { imageUrl: actual })
    expect(p.upsert).toEqual({ avatarUrl: actual })
    expect(p.parche).toEqual({})
    expect(p.base).toEqual({})
  })

  test('login: avatar subido en La Charca (hilos) se respeta y pasa a la base', () => {
    const p = planPerfil(user({ avatarUrl: actual }), page({ avatarUrl: propio }), { imageUrl: actual })
    expect(p.avatar).toBe(propio)
    expect(p.upsert.avatarUrl).toBeUndefined()
    expect(p.parche).toEqual({})
    expect(p.base).toEqual({ avatarUrl: propio })
  })

  test('nombre y bio editados en La Charca no se pisan', () => {
    const p = planPerfil(user({ displayName: 'Viejo', bio: 'bio vieja' }), page({ displayName: 'Nuevo', bio: 'bio nueva', avatarUrl: actual }), { imageUrl: actual })
    expect(p.upsert).toEqual({})
    expect(p.base).toEqual({ displayName: 'Nuevo', bio: 'bio nueva', avatarUrl: actual })
  })

  test('sin foto en Capibara: se vacia la copia rota', () => {
    const p = planPerfil(user({ avatarUrl: null }), page(), { imageUrl: null })
    expect(p.avatar).toBeNull()
    expect(p.parche).toEqual({ avatarUrl: null })
  })

  test('page nueva: se crea con todo', () => {
    const p = planPerfil(user({ avatarUrl: actual, bio: 'hola' }), null, { imageUrl: actual })
    expect(p.upsert).toEqual({ displayName: 'Vamos', bio: 'hola', avatarUrl: actual })
    expect(p.parche).toEqual({})
  })

  test('banner: copia de Capibara se renueva, propio o vacio no', () => {
    const b = 'https://r2.capibaratraductor.com/banners/1.png'
    const bn = 'https://r2.capibaratraductor.com/v2/banners/1.webp'
    expect(planPerfil(user({ avatarUrl: actual }), page({ avatarUrl: actual, bannerUrl: b }), { imageUrl: actual, bannerUrl: bn }).parche).toEqual({ bannerUrl: bn })
    expect(planPerfil(user({ avatarUrl: actual }), page({ avatarUrl: actual, bannerUrl: propio }), { imageUrl: actual, bannerUrl: bn }).parche).toEqual({})
    expect(planPerfil(user({ avatarUrl: actual }), page({ avatarUrl: actual }), { imageUrl: actual, bannerUrl: bn }).parche).toEqual({})
  })
})
