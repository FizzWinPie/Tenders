/** Single source of truth for tender search filter types. */
export const TENDER_FILTER_TYPES = [
  { id: 'date', label: 'Date' },
  { id: 'country', label: 'Country' },
  { id: 'language', label: 'Language' },
] as const

export type TenderFilterConfig = (typeof TENDER_FILTER_TYPES)[number]
export type TenderFilterId = TenderFilterConfig['id']
