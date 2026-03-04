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
import { getFilterOptions, runFilteredSearch } from '#/lib/api'
import {
  getTenderDescription,
  getTenderTitle,
  type TenderDisplay,
} from '#/types/tender'
import type { DateFilterState, FilterOptions, TenderSearchParams } from '#/types/search'
import { X } from 'lucide-react'
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

export default function HomePage() {
  const [keyword, setKeyword] = useState('')
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null)
  const [dateFilter, setDateFilter] = useState<DateFilterState>(defaultDateFilter)
  const [buyerCountries, setBuyerCountries] = useState<string[]>(['AUT', 'DEU', 'CHE'])
  const [submissionLanguages, setSubmissionLanguages] = useState<string[]>(['ENG', 'DEU'])
  const [noticeTypes, setNoticeTypes] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [tenders, setTenders] = useState<TenderDisplay[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [publicationDate, setPublicationDate] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const resultsSectionRef = useRef<HTMLElement>(null)

  const buildParams = useCallback(
    (overrides: Partial<TenderSearchParams> = {}): TenderSearchParams => {
      const mode = overrides.date_mode ?? dateFilter.date_mode
      const p: TenderSearchParams = {
        date_mode: mode,
        keyword: overrides.keyword !== undefined ? overrides.keyword : (keyword.trim() || undefined),
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
    [dateFilter, keyword, buyerCountries, submissionLanguages, noticeTypes, limit, page]
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
      buyer_countries: ['AUT', 'DEU', 'CHE'],
      submission_languages: ['ENG', 'DEU'],
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

  const activeFilterChips: { id: string; label: string; onRemove: () => void }[] = []
  if (keyword.trim()) {
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
              <Filter
                type="noticeType"
                label={TENDER_FILTER_KINDS[3].label}
                options={filterOptions.notice_types}
                value={noticeTypes}
                onChange={setNoticeTypes}
                onApply={handleFilterApply}
              />
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
