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
  limit?: number
  page?: number
}

/** Response from POST /run-filtered-search. */
export type TenderSearchResponse = {
  publication_date: string
  total_count: number
  page: number
  limit: number
  tenders: Array<{
    id: string | number
    pdf_link: string
    html_link: string
    deadline?: string
    lot_identifier: string[]
    lot_title: Record<string, string[]>
    lot_description: Record<string, string[]>
    lot_procedure_id: string[]
  }>
}

/** Request body for POST /pick-winners. */
export type TenderPickParams = {
  tenders: Array<Record<string, unknown>>
  runs?: number
  company_information_data?: string | null
  user_specific_guidelines?: string | null
}

/** Single winner from POST /pick-winners. */
export type TenderWinner = {
  rank: number
  tender: Record<string, unknown>
  reason: string
}

/** Response from POST /extract-keywords. */
export type KeywordsFromUrlResponse = {
  keywords: string[]
}
