/** Helpers del catálogo que usan tanto el servidor como el navegador. */

/**
 * Un producto puede distinguir sus variantes por más de un atributo:
 * 'capacidad, color de tapa' → ['capacidad', 'color de tapa'].
 */
export function listaAtributos(texto: string | null | undefined): string[] {
  return (texto ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

/** 'Decants Premium' → 'decants-premium' */
export function aSlug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Sugiere el SKU de una variante: 'JER' + '5 ml' → 'JER-5ML' */
export function sugerirSku(skuBase: string, valores: string[]): string {
  const partes = valores
    .map((v) =>
      v
        .toUpperCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^A-Z0-9]+/g, ''),
    )
    .filter(Boolean)
  return [skuBase.toUpperCase(), ...partes].join('-')
}

export const CLASES = [
  {
    valor: 'simple',
    label: 'Simple',
    ayuda: 'Se compra armado y se vende tal cual.',
  },
  {
    valor: 'armado',
    label: 'Armado',
    ayuda: 'Se arma con insumos y se vende (decant). Necesita receta.',
  },
  {
    valor: 'insumo',
    label: 'Insumo',
    ayuda: 'Sólo entra en recetas. No se vende suelto ni lo ve el cliente.',
  },
] as const
