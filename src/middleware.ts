// Idioma de cada petición: `?lang=` (y se recuerda) → cookie `lc_lang` →
// Accept-Language del navegador → español. Queda en `locals.idioma` y en el
// AsyncLocalStorage que lee `idiomaUi()` mientras se pinta la página.
import { AsyncLocalStorage } from 'node:async_hooks'
import { defineMiddleware } from 'astro:middleware'
import { CLAVE_ALMACEN_IDIOMA, COOKIE_IDIOMA, IDIOMA_POR_DEFECTO, esIdioma, idiomaDeAcceptLanguage, type Idioma } from './i18n'

const almacen: AsyncLocalStorage<Idioma> =
  ((globalThis as any)[CLAVE_ALMACEN_IDIOMA] ??= new AsyncLocalStorage<Idioma>())

export const onRequest = defineMiddleware((context, next) => {
  const pedido = context.url.searchParams.get('lang')
  const guardado = context.cookies.get(COOKIE_IDIOMA)?.value
  let idioma: Idioma
  if (esIdioma(pedido)) {
    idioma = pedido
    if (pedido !== guardado) {
      context.cookies.set(COOKIE_IDIOMA, pedido, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', secure: import.meta.env.PROD })
    }
  } else if (esIdioma(guardado)) {
    idioma = guardado
  } else {
    idioma = idiomaDeAcceptLanguage(context.request.headers.get('accept-language')) ?? IDIOMA_POR_DEFECTO
  }
  ;(context.locals as any).idioma = idioma
  return almacen.run(idioma, () => next())
})
