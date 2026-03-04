/** Response from GET /filter-options. */
export type FilterOptions = {
  submission_languages: string[]
  buyer_countries: string[]
  notice_types: string[]
}

/** Date filter state (for UI). YYYYMMDD strings. */
export type DateFilterState = {
  date_mode: 'exact' | 'range'
  input_date: string
  date_from: string
  date_to: string
}

/** Request body for POST /run-filtered-search. Matches backend TenderSearchRequest. */
export type TenderSearchParams = {
  date_mode?: 'exact' | 'range'
  input_date?: string | null
  date_from?: string | null
  date_to?: string | null
  keyword?: string | null
  submission_languages?: string[] | null
  buyer_countries?: string[] | null
  notice_types?: string[] | null
}

/** Response from POST /run-filtered-search. */
export type TenderSearchResponse = {
  publication_date: string
  total_count: number
  tenders: Array<{
    id: string
    pdf_link: string
    lot_identifier: string[]
    lot_title: Record<string, string[]>
    lot_description: Record<string, string[]>
    lot_procedure_id: string[]
  }>
}
