import type {
  FilterOptions,
  KeywordsFromUrlResponse,
  TenderPickParams,
  TenderSearchParams,
  TenderSearchResponse,
  TenderWinner,
} from '#/types/search'

/** API error with status and optional parsed detail for logging. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail: unknown = null
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Parse error response body and return a user-friendly German message.
 * Attach status and detail to the thrown error for logging.
 */
function throwApiError(context: string, status: number, text: string): never {
  let detail: unknown = null
  let userMessage: string

  try {
    const body = JSON.parse(text) as { detail?: unknown }
    detail = body.detail ?? null
    if (typeof detail === 'string') {
      userMessage = detail
    } else if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string }
      userMessage = first?.msg ?? `Anfrage ungültig (${status}).`
    } else {
      userMessage = statusToUserMessage(status)
    }
  } catch {
    userMessage = statusToUserMessage(status)
  }

  if (import.meta.env?.DEV) {
    console.error(`[API] ${context}`, { status, detail })
  }
  throw new ApiError(userMessage, status, detail)
}

function statusToUserMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Anfrage fehlerhaft. Bitte Eingaben prüfen.'
    case 422:
      return 'Eingaben ungültig. Bitte Filter und Datum prüfen.'
    case 429:
      return 'Zu viele Anfragen. Bitte später erneut versuchen.'
    case 500:
      return 'Serverfehler. Bitte später erneut versuchen.'
    default:
      return status >= 500 ? 'Serverfehler. Bitte später erneut versuchen.' : 'Anfrage fehlgeschlagen.'
  }
}

/**
 * Base URL for the backend API. In dev, use Vite proxy so same-origin requests
 * to /api are forwarded to the backend (see vite.config.ts server.proxy).
 */
function getApiBaseUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    return '/api'
  }
  return import.meta.env?.VITE_API_URL ?? '/api'
}

export async function getFilterOptions(): Promise<FilterOptions> {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/filter-options`)
  if (!res.ok) {
    const text = await res.text()
    throwApiError('getFilterOptions', res.status, text)
  }
  return res.json() as Promise<FilterOptions>
}

export async function runFilteredSearch(
  params: TenderSearchParams
): Promise<TenderSearchResponse> {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/run-filtered-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const text = await res.text()
    throwApiError('runFilteredSearch', res.status, text)
  }
  return res.json() as Promise<TenderSearchResponse>
}

export async function pickWinners(
  params: TenderPickParams
): Promise<TenderWinner[]> {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/pick-winners`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const text = await res.text()
    throwApiError('pickWinners', res.status, text)
  }
  return res.json() as Promise<TenderWinner[]>
}

export async function extractKeywordsFromUrl(
  params: { url: string }
): Promise<KeywordsFromUrlResponse> {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/extract-keywords`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const text = await res.text()
    throwApiError('extractKeywordsFromUrl', res.status, text)
  }
  return res.json() as Promise<KeywordsFromUrlResponse>
}
