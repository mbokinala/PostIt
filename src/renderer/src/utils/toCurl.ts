import type { RestRequest } from '@shared/ipc'

/**
 * Escape a string for use inside single quotes in a shell command.
 * Replaces ' with '\'' (end quote, escaped quote, start quote).
 */
function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'"
}

/**
 * Convert a RestRequest into a curl command string.
 */
export function toCurl(request: RestRequest): string {
  const parts: string[] = ['curl']

  // Method (omit for GET since it's the default)
  if (request.method !== 'GET') {
    parts.push('-X', request.method)
  }

  // Build URL with query params
  let fullUrl = request.url
  const enabledParams = request.params.filter((p) => p.enabled && p.key)
  if (enabledParams.length > 0) {
    try {
      const urlObj = new URL(request.url)
      for (const p of enabledParams) {
        urlObj.searchParams.append(p.key, p.value)
      }
      fullUrl = urlObj.toString()
    } catch {
      // If URL isn't fully qualified, manually append query string
      const qs = enabledParams.map((p) =>
        `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`
      ).join('&')
      fullUrl += (fullUrl.includes('?') ? '&' : '?') + qs
    }
  }
  parts.push(shellEscape(fullUrl))

  // Headers
  const enabledHeaders = request.headers.filter((h) => h.enabled && h.key)
  for (const h of enabledHeaders) {
    parts.push('-H', shellEscape(`${h.key}: ${h.value}`))
  }

  // Cookies
  const enabledCookies = (request.cookies ?? []).filter((c) => c.enabled && c.key)
  if (enabledCookies.length > 0) {
    const cookieStr = enabledCookies.map((c) => `${c.key}=${c.value}`).join('; ')
    parts.push('-b', shellEscape(cookieStr))
  }

  // Body
  const { body } = request
  if (body.type === 'json' && body.content) {
    // Add Content-Type if not already in headers
    if (!enabledHeaders.some((h) => h.key.toLowerCase() === 'content-type')) {
      parts.push('-H', shellEscape('Content-Type: application/json'))
    }
    parts.push('-d', shellEscape(body.content))
  } else if (body.type === 'text' && body.content) {
    if (!enabledHeaders.some((h) => h.key.toLowerCase() === 'content-type')) {
      parts.push('-H', shellEscape('Content-Type: text/plain'))
    }
    parts.push('-d', shellEscape(body.content))
  } else if (body.type === 'x-www-form-urlencoded') {
    if (!enabledHeaders.some((h) => h.key.toLowerCase() === 'content-type')) {
      parts.push('-H', shellEscape('Content-Type: application/x-www-form-urlencoded'))
    }
    const enabledFields = body.formData.filter((f) => f.key)
    const encoded = enabledFields
      .map((f) => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`)
      .join('&')
    if (encoded) parts.push('-d', shellEscape(encoded))
  } else if (body.type === 'form-data') {
    const enabledFields = body.formData.filter((f) => f.key)
    for (const f of enabledFields) {
      parts.push('-F', shellEscape(`${f.key}=${f.value}`))
    }
  }

  return parts.join(' ')
}
