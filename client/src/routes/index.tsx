import { Filter } from '#/components/Filter'
import { TENDER_FILTER_TYPES } from '#/constants/tender-filters'
import { InputButtonGroup } from '#/components/SearchBar'
import {
  getTenderDescription,
  getTenderTitle,
  type TenderDisplay,
} from '#/types/tender'
import { createFileRoute } from '@tanstack/react-router'
import { X } from 'lucide-react'

/** Sample data for display; replace with API response when wired. */
const SAMPLE_TENDERS: TenderDisplay[] = [
  {
    id: '148545-2026',
    pdf_link: 'https://ted.europa.eu/de/notice/148545-2026/pdf',
    lot_identifier: ['LOT-0001'],
    lot_title: {
      deu: [
        'GS Steinhude - An-/Umbau zur Ganztagsschule - Elektroinstallation - Brandmeldeanlage',
      ],
    },
    lot_description: {
      deu: [
        '1. BA Brandmeldezentrale inkl. Feuerwehr Tableau und Schlüsseldepot Ringleitungsgruppen 82 St.Mehrfachsensormelder 52 St. Mehrfachsensor mit Sirene 1 St. Ansaug Rauchmelder 8 St. Handfeuermelder Inkl. aller Leitungen , ca. 1.500 m Wartung nach AMEV 2. BA 110 St. Mehrfachsensormelder 96 St. Mehrfachsensor mit Sirene 11 St. Handfeuermelder Inkl. Leitungen, ca. 2.300 m Dokumentation inkl. Wartung als Ergänzung 3. BA 25 St. Mehrfachsensormelder 25 St. Mehrfachsensormelder mit Sirene 2 St Handfeuermelder inkl. Verlegung der Leitungen, ca. 400 m Ergänzung der Dokumentation, Feuerwehrlaufkarten und Wartung nach AMEV',
      ],
    },
    lot_procedure_id: ['24032026.0930'],
  },
  {
    id: '148545-2026',
    pdf_link: 'https://ted.europa.eu/de/notice/148545-2026/pdf',
    lot_identifier: ['LOT-0001'],
    lot_title: {
      deu: [
        'GS Steinhude - An-/Umbau zur Ganztagsschule - Elektroinstallation - Brandmeldeanlage',
      ],
    },
    lot_description: {
      deu: [
        '1. BA Brandmeldezentrale inkl. Feuerwehr Tableau und Schlüsseldepot Ringleitungsgruppen 82 St.Mehrfachsensormelder 52 St. Mehrfachsensor mit Sirene 1 St. Ansaug Rauchmelder 8 St. Handfeuermelder Inkl. aller Leitungen , ca. 1.500 m Wartung nach AMEV 2. BA 110 St. Mehrfachsensormelder 96 St. Mehrfachsensor mit Sirene 11 St. Handfeuermelder Inkl. Leitungen, ca. 2.300 m Dokumentation inkl. Wartung als Ergänzung 3. BA 25 St. Mehrfachsensormelder 25 St. Mehrfachsensormelder mit Sirene 2 St Handfeuermelder inkl. Verlegung der Leitungen, ca. 400 m Ergänzung der Dokumentation, Feuerwehrlaufkarten und Wartung nach AMEV',
      ],
    },
    lot_procedure_id: ['24032026.0930'],
  },
]

export const Route = createFileRoute('/')({ component: App })

function App() {
  return (
    <main className="page-wrap">
      <section className='flex items-end gap-2 rise-in overflow-hidden rounded-[2rem] px-6 pt-10 pb-4 sm:px-10 sm:pt-14 sm:pb-6'>
        <InputButtonGroup />
        {TENDER_FILTER_TYPES.map(({ id, label }) => (
          <Filter key={id} type={id} label={label} />
        ))}
      </section>

      <section className='flex w-full items-center justify-between gap-2 px-6 rise-in sm:px-10'>
        <div className='flex flex-row items-center gap-1 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm font-semibold text-[var(--sea-ink)] shadow-[0_8px_22px_rgba(30,90,72,0.08)] transition hover:-translate-y-0.5'>
          <span className='text-sm text-muted-foreground'>Anzuzeigende Treffer: Gelesene</span>
          <X size={12} className="shrink-0" aria-hidden />
        </div>
        <h3 className='text-base font-semibold'>{SAMPLE_TENDERS.length} Aufträge gefunden</h3>
        <Filter type='date' label='Nach Relevanz' />
      </section>

      <section className="mt-2 rounded-2xl px-6 py-6 sm:px-10">
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {SAMPLE_TENDERS.map((tender) => (
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
      </section>
    </main>
  )
}
