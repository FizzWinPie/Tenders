export default function AboutPage() {
  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">Über diese Anwendung</p>
        <h1 className="display-title mb-3 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl">
          EU-Ausschreibungs-Suche
        </h1>
        <p className="m-0 max-w-3xl text-base leading-8 text-[var(--sea-ink-soft)]">
          Mit dieser Anwendung durchsuchen Sie öffentliche Ausschreibungen aus dem
          Tenders Electronic Daily (TED). Die Daten stammen von der offiziellen TED-API.
          Sie können nach Stichwort, Veröffentlichungsdatum, Käuferland, Einreichsprache
          und Bekanntmachungstyp filtern. Zu jeder Ausschreibung gibt es Links zur
          offiziellen Bekanntmachung (PDF) und zur Webseite.
        </p>
      </section>

      <section className="island-shell mt-6 rounded-2xl p-6 sm:p-8">
        <h2 className="display-title mb-3 text-2xl font-bold text-[var(--sea-ink)]">
          So funktioniert die Oberfläche
        </h2>
        <ol className="m-0 max-w-3xl list-decimal list-inside space-y-3 text-base leading-8 text-[var(--sea-ink-soft)]">
          <li>
            <strong>Suche &amp; Filter:</strong> Geben Sie auf der Startseite ein Stichwort ein
            (z.&nbsp;B. „SAP“) und nutzen Sie die Filter für Datum, Länder, Sprachen und
            Bekanntmachungstyp. Klicken Sie auf „Suchen“, um die Ergebnisse zu laden.
          </li>
          <li>
            <strong>Unternehmens-URL (optional):</strong> Tragen Sie die Webseite Ihres
            Unternehmens ein und klicken Sie auf „Keywords von URL holen“. Die KI
            extrahiert passende Suchbegriffe; diese erscheinen als entfernbare Chips
            und werden automatisch für die Ausschreibungs-Suche genutzt.
          </li>
          <li>
            <strong>Ergebnisse:</strong> Die gefundenen Ausschreibungen werden unterhalb
            der Filter angezeigt. Über „PDF“ und „Website“ gelangen Sie direkt zur
            Bekanntmachung. Die Anzeige „Pro Seite“ und die Paginierung steuern die
            Anzahl der Treffer.
          </li>
          <li>
            <strong>Top 3 per KI:</strong> Wenn Sie „Anweisungen für die KI“ ergänzen
            und auf „Top 3 Sieger per KI auswählen“ klicken, wählt die KI aus den
            ersten fünf Ergebnissen drei passende Ausschreibungen aus und begründet
            die Auswahl. So erhalten Sie eine priorisierte Empfehlung.
          </li>
        </ol>
      </section>
    </main>
  )
}
