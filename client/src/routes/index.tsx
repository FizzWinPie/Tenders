import { Filter } from '#/components/Filter'
import { TENDER_FILTER_TYPES } from '#/constants/tender-filters'
import { InputButtonGroup } from '#/components/SearchBar'
import { runFilteredSearch } from '#/lib/api'
import {
  getTenderDescription,
  getTenderTitle,
  type TenderDisplay,
} from '#/types/tender'
import type { TenderSearchParams } from '#/types/search'
import { createFileRoute } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

export const Route = createFileRoute('/')({ component: App })

function App() {
  const [keyword, setKeyword] = useState('')
  const [tenders, setTenders] = useState<TenderDisplay[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [publicationDate, setPublicationDate] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const doSearch = useCallback(async (params: TenderSearchParams = {}) => {
    setLoading(true)
    setError(null)
    try {
      const body: TenderSearchParams = {
        date_mode: 'exact',
        keyword: params.keyword !== undefined ? params.keyword : (keyword.trim() || undefined),
        ...params,
      }
      const res = await runFilteredSearch(body)
      setTenders(res.tenders)
      setTotalCount(res.total_count)
      setPublicationDate(res.publication_date)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
      setTenders([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [keyword])

  useEffect(() => {
    setLoading(true)
    runFilteredSearch({ date_mode: 'exact' })
      .then((res) => {
        setTenders(res.tenders)
        setTotalCount(res.total_count)
        setPublicationDate(res.publication_date)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Search failed')
      })
      .finally(() => setLoading(false))
  }, [])

  function handleSearch() {
    doSearch({ keyword: keyword.trim() || undefined })
  }

  return (
    <main className="page-wrap">
      <section className='flex items-end gap-2 rise-in overflow-hidden rounded-[2rem] px-6 pt-10 pb-4 sm:px-10 sm:pt-14 sm:pb-6'>
        <InputButtonGroup
          value={keyword}
          onChange={setKeyword}
          onSearch={handleSearch}
        />
        {TENDER_FILTER_TYPES.map(({ id, label }) => (
          <Filter key={id} type={id} label={label} />
        ))}
      </section>

      <section className='flex w-full items-center justify-between gap-2 px-6 rise-in sm:px-10'>
        <div className='flex flex-row items-center gap-1 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm font-semibold text-[var(--sea-ink)] shadow-[0_8px_22px_rgba(30,90,72,0.08)] transition hover:-translate-y-0.5'>
          <span className='text-sm text-muted-foreground'>Anzuzeigende Treffer: Gelesene</span>
          <X size={12} className="shrink-0" aria-hidden />
        </div>
        <h3 className='text-base font-semibold'>
          {loading ? '…' : `${totalCount} Aufträge gefunden`}
        </h3>
        <Filter type='date' label='Nach Relevanz' />
      </section>

      {error && (
        <section className="px-6 sm:px-10">
          <p className="text-destructive" role="alert">{error}</p>
        </section>
      )}

      <section className="mt-2 rounded-2xl px-6 py-6 sm:px-10">
        {loading ? (
          <p className="text-muted-foreground">Laden…</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {tenders.map((tender) => (
              <li
                key={tender.id}
                className="island-shell rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {tender.lot_identifier.join(', ')} · {tender.lot_procedure_id.join(', ')}
                  </span>
                  <a
                    href={tender.pdf_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-primary underline"
                  >
                    PDF
                  </a>
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
        )}
      </section>
    </main>
  )
}
