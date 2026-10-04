import { catalogo } from '../index'

export default catalogo(
  {
    idioma: 'Idioma',
    cambiar: 'Cambiar idioma',
    actual: (v: { nombre: string }) => `Idioma: ${v.nombre}`,
  },
  {
    idioma: 'Language',
    cambiar: 'Change language',
    actual: (v: { nombre: string }) => `Language: ${v.nombre}`,
  },
  {
    idioma: 'Idioma',
    cambiar: 'Mudar idioma',
    actual: (v: { nombre: string }) => `Idioma: ${v.nombre}`,
  },
)
