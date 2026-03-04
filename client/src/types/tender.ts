/** Shape of a tender as returned by the search API (for display). */
export type TenderDisplay = {
  id: string
  pdf_link: string
  lot_identifier: string[]
  lot_title: Record<string, string[]>
  lot_description: Record<string, string[]>
  lot_procedure_id: string[]
}

/** Get the first available title text (any language). */
export function getTenderTitle(tender: TenderDisplay): string {
  const titles = Object.values(tender.lot_title).flat()
  return titles[0] ?? tender.id
}

/** Get the first available description text (any language), optionally truncated. */
export function getTenderDescription(tender: TenderDisplay, maxLength = 200): string {
  const descs = Object.values(tender.lot_description).flat()
  const text = descs[0] ?? ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '…'
}
