import { Filter } from '#/components/Filter'
import { TENDER_FILTER_KINDS } from '#/constants/tender-filters'
import { InputButtonGroup } from '#/components/SearchBar'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '#/components/ui/pagination'
import { getFilterOptions, extractKeywordsFromUrl, pickWinners, runFilteredSearch } from '#/lib/api'
import {
  getTenderDescription,
  getTenderTitle,
  type TenderDisplay,
} from '#/types/tender'
import type {
  DateFilterState,
  FilterOptions,
  TenderSearchParams,
  TenderWinner,
} from '#/types/search'
import { Award, Loader2, Search, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

function defaultDateFilter(): DateFilterState {
  return {
    date_mode: 'exact',
    input_date: '',
    date_from: '',
    date_to: '',
  }
}

function getDaysLeftText(deadline: string): string {
  const d = new Date(deadline)
  const now = new Date()
  const msPerDay = 24 * 60 * 60 * 1000
  const daysLeft = Math.ceil((d.getTime() - now.getTime()) / msPerDay)
  if (daysLeft > 0) return `Noch ${daysLeft} ${daysLeft === 1 ? 'Tag' : 'Tage'}`
  if (daysLeft === 0) return 'Heute'
  return 'Abgelaufen'
}

const AI_QUOTA_EXHAUSTED_MESSAGE =
  'Der KI-Agent ist derzeit nicht verfügbar (Tageslimit ausgeschöpft). Bitte später erneut versuchen.'

function isAiQuotaExhaustedError(message: string): boolean {
  return (
    message.includes('429') ||
    message.toLowerCase().includes('quota') ||
    message.toLowerCase().includes('resource_exhausted')
  )
}

export default function HomePage() {
  const [keyword, setKeyword] = useState('')
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null)
  const [dateFilter, setDateFilter] = useState<DateFilterState>(defaultDateFilter)
  const [buyerCountries, setBuyerCountries] = useState<string[]>([])
  const [submissionLanguages, setSubmissionLanguages] = useState<string[]>([])
  const [noticeTypes, setNoticeTypes] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [tenders, setTenders] = useState<TenderDisplay[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [publicationDate, setPublicationDate] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [winners, setWinners] = useState<TenderWinner[]>([])
  const [pickLoading, setPickLoading] = useState(false)
  const [pickError, setPickError] = useState<string | null>(null)
  const [companyUrl, setCompanyUrl] = useState('')
  const [companyInfo, setCompanyInfo] = useState('')
  const [extractedKeywords, setExtractedKeywords] = useState<string[]>([])
  const [keywordsLoading, setKeywordsLoading] = useState(false)
  const [keywordsError, setKeywordsError] = useState<string | null>(null)
  const [guidelines, setGuidelines] = useState('')
  const resultsSectionRef = useRef<HTMLElement>(null)

  const buildParams = useCallback(
    (overrides: Partial<TenderSearchParams> = {}): TenderSearchParams => {
      const mode = overrides.date_mode ?? dateFilter.date_mode
      const p: TenderSearchParams = {
        date_mode: mode,
        keyword: overrides.keyword !== undefined ? overrides.keyword : (extractedKeywords.length > 0 ? extractedKeywords.join(' ') : (keyword.trim() || undefined)),
        limit: overrides.limit ?? limit,
        page: overrides.page ?? page,
      }
      if (mode === 'range' && overrides.date_from === undefined && overrides.date_to === undefined && dateFilter.date_from && dateFilter.date_to) {
        p.date_from = dateFilter.date_from
        p.date_to = dateFilter.date_to
      } else if (mode === 'exact' && overrides.input_date === undefined && dateFilter.input_date) {
        p.input_date = dateFilter.input_date
      }
      const bc = overrides.buyer_countries !== undefined ? overrides.buyer_countries : buyerCountries
      if (bc && bc.length > 0) p.buyer_countries = bc
      const sl = overrides.submission_languages !== undefined ? overrides.submission_languages : submissionLanguages
      if (sl && sl.length > 0) p.submission_languages = sl
      const nt = overrides.notice_types !== undefined ? overrides.notice_types : noticeTypes
      if (nt && nt.length > 0) p.notice_types = nt
      return p
    },
    [dateFilter, keyword, extractedKeywords, buyerCountries, submissionLanguages, noticeTypes, limit, page]
  )

  const doSearch = useCallback(
    async (params?: TenderSearchParams) => {
      setLoading(true)
      setError(null)
      try {
        const body = params ?? buildParams()
        const res = await runFilteredSearch(body)
        setTenders(res.tenders)
        setTotalCount(res.total_count)
        setPublicationDate(res.publication_date)
        setPage(res.page)
        setLimit(res.limit)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed')
        setTenders([])
        setTotalCount(0)
      } finally {
        setLoading(false)
      }
    },
    [buildParams]
  )

  useEffect(() => {
    getFilterOptions()
      .then(setFilterOptions)
      .catch(() => setFilterOptions({ submission_languages: [], buyer_countries: [], notice_types: [] }))
  }, [])

  useEffect(() => {
    setLoading(true)
    runFilteredSearch({
      date_mode: 'exact',
      limit: 10,
      page: 1,
    })
      .then((res) => {
        setTenders(res.tenders)
        setTotalCount(res.total_count)
        setPublicationDate(res.publication_date)
        setPage(res.page)
        setLimit(res.limit)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Search failed'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (page > 1) resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [page])

  function handleSearch() {
    doSearch(buildParams({ page: 1 }))
  }

  function handleFilterApply() {
    doSearch(buildParams({ page: 1 }))
  }

  const handlePickWinners = useCallback(async () => {
    const shortlist = tenders.slice(0, 5)
    if (shortlist.length === 0) return
    setPickLoading(true)
    setPickError(null)
    setWinners([])
    try {
      const list = await pickWinners({
        tenders: shortlist as Array<Record<string, unknown>>,
        runs: 3,
        company_information_data: companyInfo.trim() || undefined,
        user_specific_guidelines: guidelines.trim() || undefined,
      })
      setWinners(list)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Pick winners failed'
      setPickError(isAiQuotaExhaustedError(msg) ? AI_QUOTA_EXHAUSTED_MESSAGE : msg)
    } finally {
      setPickLoading(false)
    }
  }, [tenders, companyInfo, guidelines])

  const handleFetchKeywords = useCallback(async () => {
    const url = companyUrl.trim()
    if (!url) return
    setKeywordsLoading(true)
    setKeywordsError(null)
    try {
      const { keywords } = await extractKeywordsFromUrl({ url })
      if (keywords.length > 0) {
        setExtractedKeywords(keywords.slice(0, 5))
        setCompanyInfo(keywords.join(', '))
        await doSearch(buildParams({ keyword: keywords.join(' '), page: 1 }))
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Keyword extraction failed'
      setKeywordsError(isAiQuotaExhaustedError(msg) ? AI_QUOTA_EXHAUSTED_MESSAGE : msg)
    } finally {
      setKeywordsLoading(false)
    }
  }, [companyUrl, buildParams, doSearch])

  const activeFilterChips: { id: string; label: string; onRemove: () => void }[] = []
  if (extractedKeywords.length > 0) {
    extractedKeywords.forEach((kw, i) => {
      activeFilterChips.push({
        id: `kw-${i}-${kw}`,
        label: kw,
        onRemove: () => {
          const newList = extractedKeywords.filter((_, idx) => idx !== i)
          setExtractedKeywords(newList)
          doSearch(buildParams({ keyword: newList.length > 0 ? newList.join(' ') : undefined, page: 1 }))
        },
      })
    })
  } else if (keyword.trim()) {
    activeFilterChips.push({
      id: 'keyword',
      label: `Stichwort: ${keyword.trim()}`,
      onRemove: () => {
        setKeyword('')
        doSearch(buildParams({ keyword: undefined }))
      },
    })
  }
  const hasDateFilter =
    (dateFilter.date_mode === 'exact' && dateFilter.input_date) ||
    (dateFilter.date_mode === 'range' && dateFilter.date_from && dateFilter.date_to)
  if (hasDateFilter) {
    const dateLabel =
      dateFilter.date_mode === 'exact'
        ? dateFilter.input_date
        : `${dateFilter.date_from} – ${dateFilter.date_to}`
    activeFilterChips.push({
      id: 'date',
      label: `Datum: ${dateLabel}`,
      onRemove: () => {
        setDateFilter(defaultDateFilter())
        doSearch(buildParams({ date_mode: 'exact', input_date: undefined, date_from: undefined, date_to: undefined }))
      },
    })
  }
  if (buyerCountries.length > 0) {
    activeFilterChips.push({
      id: 'countries',
      label: `Länder: ${buyerCountries.join(', ')}`,
      onRemove: () => {
        setBuyerCountries([])
        doSearch(buildParams({ buyer_countries: [] }))
      },
    })
  }
  if (submissionLanguages.length > 0) {
    activeFilterChips.push({
      id: 'languages',
      label: `Sprachen: ${submissionLanguages.join(', ')}`,
      onRemove: () => {
        setSubmissionLanguages([])
        doSearch(buildParams({ submission_languages: [] }))
      },
    })
  }
  if (noticeTypes.length > 0) {
    activeFilterChips.push({
      id: 'noticeTypes',
      label: `Typ: ${noticeTypes.join(', ')}`,
      onRemove: () => {
        setNoticeTypes([])
        doSearch(buildParams({ notice_types: [] }))
      },
    })
  }

  return (
    <main className="page-wrap">
      {(pickError === AI_QUOTA_EXHAUSTED_MESSAGE || keywordsError === AI_QUOTA_EXHAUSTED_MESSAGE) && (
        <section className="mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 sm:mx-6 sm:px-6" role="alert">
          <p className="m-0 text-sm font-medium">
            {AI_QUOTA_EXHAUSTED_MESSAGE}
          </p>
        </section>
      )}
      <section className='flex flex-wrap items-end gap-2 rise-in overflow-hidden rounded-[2rem] px-6 pt-10 pb-4 sm:px-10 sm:pt-14 sm:pb-6'>
        <div className='flex flex-row w-full items-end gap-1'>
          <InputButtonGroup
            value={keyword}
            onChange={setKeyword}
            onSearch={handleSearch}
          />
          {filterOptions && (
            <>
              <Filter
                type="date"
                label={TENDER_FILTER_KINDS[0].label}
                value={dateFilter}
                onChange={setDateFilter}
                onApply={handleFilterApply}
              />
              <Filter
                type="country"
                label={TENDER_FILTER_KINDS[1].label}
                options={filterOptions.buyer_countries}
                value={buyerCountries}
                onChange={setBuyerCountries}
                onApply={handleFilterApply}
              />
              <Filter
                type="language"
                label={TENDER_FILTER_KINDS[2].label}
                options={filterOptions.submission_languages}
                value={submissionLanguages}
                onChange={setSubmissionLanguages}
                onApply={handleFilterApply}
              />
              {/* <Filter
                type="noticeType"
                label={TENDER_FILTER_KINDS[3].label}
                options={filterOptions.notice_types}
                value={noticeTypes}
                onChange={setNoticeTypes}
                onApply={handleFilterApply}
              /> */}
            </>
          )}
        </div>
      </section>

      <section className='flex w-full flex-wrap items-center justify-between gap-2 px-6 rise-in sm:px-10'>
        <div className='flex flex-wrap items-center gap-2'>
          {activeFilterChips.length > 0 ? (
            activeFilterChips.map((chip) => (
              <span
                key={chip.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm font-medium text-[var(--sea-ink)] shadow-sm"
              >
                {chip.label}
                <button
                  type="button"
                  onClick={chip.onRemove}
                  aria-label={`${chip.label} entfernen`}
                  className="rounded-full p-0.5 transition hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <X size={14} aria-hidden />
                </button>
              </span>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">Keine Filter aktiv</span>
          )}
        </div>
        <h3 className='text-base font-semibold'>
          {loading ? '…' : `${totalCount} Aufträge gefunden`}
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Pro Seite:</span>
            <select
              value={limit}
              onChange={(e) => {
                const newLimit = Number(e.target.value)
                setLimit(newLimit)
                setPage(1)
                doSearch(buildParams({ limit: newLimit, page: 1 }))
              }}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              aria-label="Ergebnisse pro Seite"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </label>
          {totalCount > 0 && (
            <span className="text-sm text-muted-foreground">
              Anzeige {(page - 1) * limit + 1}–{Math.min(page * limit, totalCount)} von {totalCount}
            </span>
          )}
        </div>
      </section>

      <section className="mt-4 flex flex-wrap items-stretch gap-4 px-6 sm:px-10">
        <div className="flex flex-1 flex-col gap-2 min-w-[200px]">
          <label htmlFor="company-url" className="text-sm font-medium text-muted-foreground">
            Unternehmens-URL
          </label>
          <input
            id="company-url"
            type="url"
            value={companyUrl}
            onChange={(e) => setCompanyUrl(e.target.value)}
            placeholder="z.B. https://amazing-company.com"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            aria-label="Company website URL for keyword extraction"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFetchKeywords}
              disabled={!companyUrl.trim() || keywordsLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium transition hover:bg-accent disabled:opacity-50 disabled:pointer-events-none"
            >
              {keywordsLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Keywords werden ermittelt…
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5" aria-hidden />
                  Keywords von URL holen
                </>
              )}
            </button>
          </div>
          {keywordsError && (
            <p className="text-sm text-destructive" role="alert">{keywordsError}</p>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 min-w-[200px]">
          <label htmlFor="user-guidelines" className="text-sm font-medium text-muted-foreground">
            Anweisungen für die KI (empfohlen)
          </label>
          <textarea
            id="user-guidelines"
            value={guidelines}
            onChange={(e) => setGuidelines(e.target.value)}
            placeholder="z.B. Bevorzuge Langfristverträge"
            rows={2}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-y"
            aria-label="User guidelines for LLM"
          />
        </div>
        <div className="flex flex-col justify-end">
          <button
            type="button"
            onClick={handlePickWinners}
            disabled={tenders.length === 0 || pickLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)] shadow-sm transition hover:bg-[var(--link-bg-hover)] disabled:opacity-50 disabled:pointer-events-none"
          >
            {pickLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Wird ausgewählt…
              </>
            ) : (
              <>
                <Award className="h-4 w-4" aria-hidden />
                Top 3 Sieger per KI auswählen
              </>
            )}
          </button>
          <p className="mt-1 text-xs text-muted-foreground">
            Nutzt die ersten 5 Ausschreibungen aus den Ergebnissen
          </p>
        </div>
      </section>

      {pickError && (
        <section className="px-6 sm:px-10">
          <p className="text-destructive" role="alert">{pickError}</p>
        </section>
      )}

      {winners.length > 0 && (
        <section className="mt-6 px-6 sm:px-10" aria-label="LLM picks">
          <h3 className="mb-3 text-lg font-semibold flex items-center gap-2">
            <Award className="h-5 w-5 text-[var(--lagoon-deep)]" />
            Top 3 picks
          </h3>
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {winners.map((w) => (
              <li
                key={w.rank}
                className="island-shell rounded-xl border border-border bg-card p-4 shadow-sm border-l-4 border-l-[var(--lagoon)]"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-full bg-[var(--lagoon)]/20 px-2 py-0.5 text-xs font-bold text-[var(--sea-ink)]">
                    #{w.rank}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    ID: {String((w.tender as { id?: string | number }).id ?? '—')}
                  </span>
                </div>
                <h4 className="mb-1 text-base font-semibold leading-tight">
                  {getTenderTitle(w.tender as TenderDisplay)}
                </h4>
                <p className="mb-2 text-sm text-muted-foreground">
                  {getTenderDescription(w.tender as TenderDisplay)}
                </p>
                <p className="text-sm font-medium text-[var(--sea-ink-soft)]">
                  Why: {w.reason}
                </p>
                <div className="mt-2 flex gap-2">
                  <a
                    href={(w.tender as { pdf_link?: string }).pdf_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-primary underline"
                  >
                    PDF
                  </a>
                  <a
                    href={(w.tender as { html_link?: string }).html_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-primary underline"
                  >
                    Website
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <section className="px-6 sm:px-10">
          <p className="text-destructive" role="alert">{error}</p>
        </section>
      )}

      <section ref={resultsSectionRef} className="mt-2 rounded-2xl px-6 py-6 sm:px-10">
        {loading ? (
          <p className="text-muted-foreground">Laden…</p>
        ) : (
          <>
            <ul className="m-0 flex list-none flex-col gap-4 p-0">
              {tenders.map((tender) => (
                <li
                  key={tender.id}
                  className="island-shell rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="mb-2 flex flex-wrap justify-between items-center gap-2">
                    <div className='flex gap-2'>
                      <span className="text-xs font-medium text-muted-foreground">
                        ID: {(tender.id ?? "N/A")}
                      </span>
                      {tender.deadline && (
                        <>
                          <span className="text-xs text-muted-foreground" aria-hidden>·</span>
                          <p className="text-xs font-medium text-green-700/70 dark:text-green-400">
                          {getDaysLeftText(tender.deadline)}
                          </p>
                        </>
                      )}
                    </div>
                    <div className='flex gap-2'>
                      <a
                        href={tender.pdf_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-primary underline"
                      >
                        PDF
                      </a>
                      <a
                        href={tender.html_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-primary underline"
                      >
                        Website
                      </a>
                    </div>
                  </div>
                  <h2 className="mb-2 text-base font-semibold leading-tight">
                    {getTenderTitle(tender)}
                  </h2>
                  <p className="m-0 text-sm text-muted-foreground">
                    {getTenderDescription(tender)}
                  </p>
                </li>
              ))}
            </ul>
            {totalCount > 0 && totalCount > limit && (() => {
              const totalPages = Math.max(1, Math.ceil(totalCount / limit))
              return (
                <Pagination className="mt-6">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          if (page > 1 && !loading) doSearch(buildParams({ page: page - 1 }))
                        }}
                        className={page <= 1 || loading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        aria-disabled={page <= 1 || loading}
                      />
                    </PaginationItem>
                    {(() => {
                      const show: number[] = [1]
                      if (totalPages > 1) {
                        for (const p of [page - 1, page, page + 1]) {
                          if (p >= 2 && p <= totalPages - 1 && !show.includes(p)) show.push(p)
                        }
                        show.push(totalPages)
                        show.sort((a, b) => a - b)
                      }
                      const nodes: React.ReactNode[] = []
                      let prev = 0
                      for (const p of show) {
                        if (prev !== 0 && p > prev + 1) {
                          nodes.push(
                            <PaginationItem key={`e-${prev}`}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )
                        }
                        nodes.push(
                          <PaginationItem key={p}>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault()
                                if (!loading) doSearch(buildParams({ page: p }))
                              }}
                              isActive={page === p}
                              className="cursor-pointer"
                            >
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        )
                        prev = p
                      }
                      return nodes
                    })()}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          if (page < totalPages && !loading) doSearch(buildParams({ page: page + 1 }))
                        }}
                        className={page >= totalPages || loading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        aria-disabled={page >= totalPages || loading}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )
            })()}
          </>
        )}
      </section>
    </main>
  )
}
