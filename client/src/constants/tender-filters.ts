/** Filter kinds shown in the UI; options come from backend GET /filter-options. */
export const TENDER_FILTER_KINDS = [
  { id: 'date', label: 'Datum' },
  { id: 'country', label: 'Land' },
  { id: 'language', label: 'Sprache' },
  { id: 'noticeType', label: 'Bekanntmachungstyp' },
] as const

export type TenderFilterId = (typeof TENDER_FILTER_KINDS)[number]['id']
