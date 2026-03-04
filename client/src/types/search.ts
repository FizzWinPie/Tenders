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
