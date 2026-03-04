import type { TenderSearchParams, TenderSearchResponse } from '#/types/search'

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
    throw new Error(`Search failed: ${res.status} ${text}`)
  }
  return res.json() as Promise<TenderSearchResponse>
}
