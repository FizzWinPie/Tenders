/** Shape of a tender as returned by the search API (for display). */
export type TenderDisplay = {
  id: string | number
  pdf_link: string
  html_link: string
  deadline?: string | null
  lot_identifier?: string[] | null
  lot_title?: Record<string, string[]> | null
  lot_description?: Record<string, string[]> | null
  lot_procedure_id?: string[] | null
}

/** Get the first available title text (any language). */
export function getTenderTitle(tender: TenderDisplay): string {
  const titleObj = tender.lot_title ?? {}
  const titles = Object.values(titleObj).flat()
  return titles[0] ?? tender.id
}

/** Get the first available description text (any language), optionally truncated. */
export function getTenderDescription(tender: TenderDisplay, maxLength = 200): string {
  const descObj = tender.lot_description ?? {}
  const descs = Object.values(descObj).flat()
  const text = descs[0] ?? ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '…'
}
