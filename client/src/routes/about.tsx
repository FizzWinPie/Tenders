import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">About</p>
        <h1 className="display-title mb-3 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl">
          EU Tender Search Tool
        </h1>
        <p className="m-0 max-w-3xl text-base leading-8 text-[var(--sea-ink-soft)]">
          This tool helps you search and filter public procurement notices from the
          European Tenders Electronic Daily (TED). Use the search bar and filters on
          the home page to find tenders by keyword, publication date, buyer country,
          submission language, and notice type. Results are fetched from the
          official TED API and link directly to the published notices (PDF).
        </p>
      </section>
    </main>
  )
}
