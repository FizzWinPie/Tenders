import { Link, NavLink } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--header-bg)] backdrop-blur-lg">
      <nav className="page-wrap flex items-center justify-between gap-4 px-6 py-3 sm:px-10 sm:py-4">
        <h2 className="m-0 flex-shrink-0 text-base font-semibold tracking-tight">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm text-[var(--sea-ink)] no-underline shadow-[0_8px_24px_rgba(30,90,72,0.08)] sm:px-4 sm:py-2"
          >
            EU Tender AI Search Tool
          </Link>
        </h2>

        <div className="flex flex-1 justify-center gap-x-6 gap-y-1 sm:gap-x-8">
          <NavLink
            to="/"
            className={({ isActive }: { isActive: boolean }) => `nav-link ${isActive ? 'is-active' : ''}`}
          >
            Home
          </NavLink>
          <NavLink
            to="/about"
            className={({ isActive }: { isActive: boolean }) => `nav-link ${isActive ? 'is-active' : ''}`}
          >
            About
          </NavLink>
        </div>

        <div className="flex flex-shrink-0">
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
