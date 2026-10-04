// i18n de La Charca: español, inglés y portugués (mismo sistema que
// CapibaraTraductor, adaptado a un solo dominio).
//
// - Los textos viven en catálogos por área (`src/i18n/catalogos/<area>.ts`),
//   creados con `catalogo(es, en, pt)`: `en` y `pt` tienen EXACTAMENTE las
//   mismas claves que `es` (lo exige el tipo).
// - En React y en Astro: `const t = useT(cat)`; `t('clave')`,
//   `t('clave', { n: 3 })` (huecos `{n}`), plurales como función en el
//   catálogo. `t.rich('clave', { a: (txt) => <a>{txt}</a> })` para textos con
//   etiquetas. `t.locale` da el locale para fechas y números.
// - Idioma de la interfaz (`idiomaUi()`): en el servidor, el de la petición
//   (src/middleware.ts lo guarda en un AsyncLocalStorage); en el navegador,
//   `<html lang>`. Servidor y navegador dan lo mismo: hidratar no cambia nada.
// - El idioma elegido vive en la cookie `lc_lang` (un año). Sin cookie se usa
//   el del navegador (Accept-Language) y, si no es ninguno de los tres, español.

import { createElement, Fragment, type ReactNode } from 'react';

export type Idioma = 'es' | 'en' | 'pt';
export const IDIOMAS: readonly Idioma[] = ['es', 'en', 'pt'];
export const IDIOMA_POR_DEFECTO: Idioma = 'es';

export function esIdioma(v: unknown): v is Idioma {
  return v === 'es' || v === 'en' || v === 'pt';
}

/** Locale de cada idioma cuando el texto original no fijaba uno. */
export const LOCALE_DE: Record<Idioma, string> = { es: 'es-ES', en: 'en-US', pt: 'pt-BR' };

/** Nombre de cada idioma en su propio idioma (para el selector). */
export const NOMBRE_IDIOMA: Record<Idioma, string> = { es: 'Español', en: 'English', pt: 'Português' };

/** Cookie donde se recuerda el idioma elegido. */
export const COOKIE_IDIOMA = 'lc_lang';

/** Guarda el idioma elegido (un año) y recarga la página en ese idioma. */
export function cambiarIdioma(idioma: Idioma) {
  document.cookie = `${COOKIE_IDIOMA}=${idioma}; path=/; max-age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  try { localStorage.setItem(COOKIE_IDIOMA, idioma); } catch {}
  const url = new URL(location.href);
  url.searchParams.delete('lang');
  location.replace(url.href);
}

/** Primer idioma soportado de una cabecera Accept-Language, o null. */
export function idiomaDeAcceptLanguage(cabecera: string | null | undefined): Idioma | null {
  if (!cabecera) return null;
  const prefs = cabecera
    .split(',')
    .map((parte) => {
      const [tag, ...params] = parte.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      return { lang: tag.slice(0, 2).toLowerCase(), q: q ? Number(q.slice(2)) || 0 : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const p of prefs) if (esIdioma(p.lang)) return p.lang;
  return null;
}

type Fn = (v: any) => string;
export type Texto = string | Fn;
export type Mensajes = Record<string, Texto>;

/** Forma que deben tener el `en` y el `pt` de un catálogo: mismas claves que `es`. */
export type Traduccion<E extends Mensajes> = {
  [K in keyof E]: E[K] extends (v: infer V) => string ? (v: V) => string : string;
};

export interface Catalogo<E extends Mensajes = Mensajes> {
  es: E;
  en: Traduccion<E>;
  pt: Traduccion<E>;
}

/**
 * Crea un catálogo: `catalogo({ hola: 'Hola' }, { hola: 'Hi' }, { hola: 'Olá' })`.
 * Las claves del inglés y del portugués las controla el tipo (ni de más ni de menos).
 */
export function catalogo<const E extends Mensajes>(es: E, en: Traduccion<E>, pt: Traduccion<E>): Catalogo<E> {
  return { es, en, pt };
}

/** Une catálogos (claves distintas) para usarlos con un solo `t`. */
export function unir<A extends Mensajes, B extends Mensajes>(a: Catalogo<A>, b: Catalogo<B>): Catalogo<A & B> {
  return { es: { ...a.es, ...b.es }, en: { ...a.en, ...b.en }, pt: { ...a.pt, ...b.pt } } as unknown as Catalogo<A & B>;
}

type Vars = Record<string, string | number | null | undefined>;
type ArgsDe<T> = T extends (v: infer V) => string ? [vars: V] : [vars?: Vars];

export interface T<E extends Mensajes> {
  <K extends keyof E & string>(clave: K, ...vars: ArgsDe<E[K]>): string;
  /** Texto con etiquetas `<x>...</x>` reemplazadas por nodos de React. */
  rich<K extends keyof E & string>(
    clave: K,
    etiquetas: Record<string, (contenido: string) => ReactNode>,
    vars?: Vars,
  ): ReactNode;
  idioma: Idioma;
  /** Locale para Intl del idioma (igual que `locale`). */
  loc: () => string;
  /** Locale del idioma: 'es-ES', 'en-US' o 'pt-BR'. */
  locale: string;
}

/** Rellena `{nombre}` con `vars`. Sin `vars`, el texto sale intacto. */
export function interpolar(texto: string, vars?: Vars | null): string {
  if (!vars) return texto;
  return texto.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])));
}

// AsyncLocalStorage del servidor (lo crea el middleware, solo en el servidor,
// para no meter node:async_hooks en el bundle del navegador).
type AlmacenIdioma = { getStore(): unknown };
const CLAVE_ALS = '__lcIdiomaUi';

/** Idioma de la interfaz en este momento (ver cabecera del archivo). */
export function idiomaUi(): Idioma {
  if (typeof document !== 'undefined') {
    const lang = (document.documentElement?.lang || '').slice(0, 2).toLowerCase();
    return esIdioma(lang) ? lang : IDIOMA_POR_DEFECTO;
  }
  const als = (globalThis as Record<string, unknown>)[CLAVE_ALS] as AlmacenIdioma | undefined;
  const v = als?.getStore?.();
  return esIdioma(v) ? v : IDIOMA_POR_DEFECTO;
}

export const CLAVE_ALMACEN_IDIOMA = CLAVE_ALS;

/** Traductor de un catálogo en un idioma dado (por defecto, el de la interfaz). */
export function traductor<E extends Mensajes>(cat: Catalogo<E>, idioma: Idioma = idiomaUi()): T<E> {
  const tabla = (cat[idioma] ?? cat.es) as Mensajes;
  const texto = (clave: string, vars?: Vars): string => {
    const v = tabla[clave] ?? (cat.es as Mensajes)[clave];
    if (v === undefined) return clave;
    return typeof v === 'function' ? v(vars ?? {}) : interpolar(v, vars);
  };
  const t = texto as unknown as T<E>;
  t.rich = (clave, etiquetas, vars) => {
    const s = texto(clave, vars);
    const partes: ReactNode[] = [];
    const re = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let ultimo = 0;
    for (let m = re.exec(s); m; m = re.exec(s)) {
      if (m.index > ultimo) partes.push(s.slice(ultimo, m.index));
      const f = etiquetas[m[1]];
      partes.push(f ? f(m[2]) : m[2]);
      ultimo = m.index + m[0].length;
    }
    if (ultimo < s.length) partes.push(s.slice(ultimo));
    return createElement(Fragment, null, ...partes);
  };
  t.idioma = idioma;
  t.loc = () => LOCALE_DE[idioma];
  t.locale = LOCALE_DE[idioma];
  return t;
}

/**
 * Traductor para componentes (React y Astro). No usa hooks de React: se
 * puede llamar donde sea, pero por convención va al principio del componente.
 */
export function useT<E extends Mensajes>(cat: Catalogo<E>): T<E> {
  return traductor(cat);
}

/** Idioma de la interfaz (alias para componentes). */
export function useIdioma(): Idioma {
  return idiomaUi();
}

/** Locale para Intl del idioma de la interfaz. */
export function locUi(): string {
  return LOCALE_DE[idiomaUi()];
}
