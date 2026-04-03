import type { HttpMethod, KeyValuePair, RequestBody, BodyType } from '@shared/ipc'
import { v4 as uuidv4 } from 'uuid'

export interface ParsedCurl {
  method: HttpMethod
  url: string
  headers: KeyValuePair[]
  cookies: KeyValuePair[]
  params: KeyValuePair[]
  body: RequestBody
}

const VALID_METHODS = new Set<HttpMethod>([
  'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'
])

// Flags that take no argument (boolean flags)
const NO_ARG_FLAGS = new Set([
  '-k', '--insecure',
  '-L', '--location',
  '-s', '--silent',
  '-S', '--show-error',
  '-v', '--verbose',
  '-i', '--include',
  '-I', '--head',
  '--compressed',
  '-N', '--no-buffer',
  '-f', '--fail',
  '-g', '--globoff',
  '-n', '--netrc',
  '-q',
  '--raw',
  '--tr-encoding',
])

// Flags that take one argument (we skip both the flag and its value)
const SKIP_ARG_FLAGS = new Set([
  '-o', '--output',
  '-w', '--write-out',
  '-e', '--referer',
  '-A', '--user-agent',
  '-m', '--max-time',
  '--connect-timeout',
  '-r', '--range',
  '-C', '--continue-at',
  '--retry',
  '--retry-delay',
  '--retry-max-time',
  '-x', '--proxy',
  '-U', '--proxy-user',
  '--cacert',
  '--capath',
  '--cert',
  '--key',
  '--ciphers',
  '--resolve',
  '-E',
  '--interface',
  '--local-port',
])

/**
 * Tokenize a curl command string, respecting quoted strings and backslash escapes.
 * Handles multiline commands with trailing backslashes.
 */
function tokenize(input: string): string[] {
  // Normalize multiline: remove backslash + newline continuations (handles \n, \r\n, \r)
  const normalized = input.replace(/\\\s*[\r\n]+\s*/g, ' ')

  const tokens: string[] = []
  let i = 0
  const len = normalized.length

  while (i < len) {
    // Skip whitespace
    while (i < len && /\s/.test(normalized[i])) i++
    if (i >= len) break

    const char = normalized[i]

    if (char === "'" || char === '"') {
      // Quoted string
      const quote = char
      i++ // skip opening quote
      let token = ''
      while (i < len && normalized[i] !== quote) {
        if (normalized[i] === '\\' && quote === '"' && i + 1 < len) {
          // In double quotes, backslash escapes the next char
          i++
          token += normalized[i]
        } else {
          token += normalized[i]
        }
        i++
      }
      i++ // skip closing quote
      tokens.push(token)
    } else {
      // Unquoted token
      let token = ''
      while (i < len && !/\s/.test(normalized[i])) {
        if (normalized[i] === '\\' && i + 1 < len) {
          i++
          token += normalized[i]
        } else {
          token += normalized[i]
        }
        i++
      }
      tokens.push(token)
    }
  }

  return tokens
}

function mkPair(key: string, value: string): KeyValuePair {
  return { id: uuidv4(), key, value, enabled: true }
}

// Short flags that take an argument — the last flag in a combined group
// can be one of these, consuming the next token as its value.
const SHORT_ARG_FLAGS = new Set([
  'X', 'H', 'd', 'b', 'u', 'F', 'o', 'w', 'e', 'A', 'm', 'r', 'C', 'x', 'U', 'E',
])

/**
 * Expand combined short flags like -fsSL into [-f, -s, -S, -L].
 * If the last character is a flag that takes an argument, the next token
 * is kept as its argument.
 */
function expandCombinedFlags(tokens: string[]): string[] {
  const result: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    // Match combined short flags: starts with -, not --, more than 2 chars, all alpha
    if (/^-[a-zA-Z]{2,}$/.test(t)) {
      const chars = t.slice(1) // remove leading -
      for (let j = 0; j < chars.length; j++) {
        result.push(`-${chars[j]}`)
        // If this is the last char and it takes an argument, the next token is its value
        if (j === chars.length - 1 && SHORT_ARG_FLAGS.has(chars[j]) && i + 1 < tokens.length) {
          result.push(tokens[++i])
        }
      }
    } else {
      result.push(t)
    }
  }
  return result
}

/**
 * Parse a curl command string into structured request data.
 */
export function parseCurl(input: string): ParsedCurl | null {
  // Strip leading $ (common in docs)
  let cleaned = input.trim()
  if (cleaned.startsWith('$ ')) cleaned = cleaned.slice(2).trim()

  // Must start with "curl"
  if (!/^curl\s/i.test(cleaned)) return null

  const rawTokens = tokenize(cleaned)
  // Remove the "curl" token
  rawTokens.shift()

  // Expand combined short flags like -fsSL into -f -s -S -L
  const tokens = expandCombinedFlags(rawTokens)

  let method: HttpMethod | null = null
  let url = ''
  const headers: KeyValuePair[] = []
  const cookies: KeyValuePair[] = []
  let bodyContent = ''
  const formEntries: KeyValuePair[] = []
  let hasData = false
  let hasForm = false
  let isHead = false

  let i = 0
  while (i < tokens.length) {
    const token = tokens[i]

    if (token === '-X' || token === '--request') {
      i++
      const m = tokens[i]?.toUpperCase() as HttpMethod
      if (m && VALID_METHODS.has(m)) method = m
    } else if (token === '-H' || token === '--header') {
      i++
      const headerStr = tokens[i]
      if (headerStr) {
        const colonIdx = headerStr.indexOf(':')
        if (colonIdx > 0) {
          const key = headerStr.slice(0, colonIdx).trim()
          const value = headerStr.slice(colonIdx + 1).trim()
          // Skip cookie headers — they'll be handled via -b or we parse them here
          if (key.toLowerCase() === 'cookie') {
            parseCookieString(value, cookies)
          } else {
            headers.push(mkPair(key, value))
          }
        }
      }
    } else if (
      token === '-d' || token === '--data' ||
      token === '--data-raw' || token === '--data-binary' ||
      token === '--data-ascii' || token === '--data-urlencode'
    ) {
      i++
      hasData = true
      if (tokens[i] != null) {
        if (bodyContent) bodyContent += '&'
        bodyContent += tokens[i]
      }
    } else if (token === '-b' || token === '--cookie') {
      i++
      if (tokens[i]) parseCookieString(tokens[i], cookies)
    } else if (token === '-u' || token === '--user') {
      i++
      if (tokens[i]) {
        const encoded = btoa(tokens[i])
        headers.push(mkPair('Authorization', `Basic ${encoded}`))
      }
    } else if (token === '-F' || token === '--form') {
      i++
      hasForm = true
      if (tokens[i]) {
        const eqIdx = tokens[i].indexOf('=')
        if (eqIdx > 0) {
          formEntries.push(mkPair(
            tokens[i].slice(0, eqIdx),
            tokens[i].slice(eqIdx + 1)
          ))
        }
      }
    } else if (token === '-I' || token === '--head') {
      isHead = true
    } else if (NO_ARG_FLAGS.has(token)) {
      // skip
    } else if (SKIP_ARG_FLAGS.has(token)) {
      i++ // skip the argument too
    } else if (token.startsWith('-') && token.length === 2 && !VALID_METHODS.has(token as HttpMethod)) {
      // Unknown short flag — might take an arg, skip conservatively
      // But only if the next token doesn't look like a URL
      if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-') && !looksLikeUrl(tokens[i + 1])) {
        i++
      }
    } else if (token.startsWith('--')) {
      // Unknown long flag — skip its argument if next token doesn't look like a URL/flag
      if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-') && !looksLikeUrl(tokens[i + 1])) {
        i++
      }
    } else if (!url) {
      // Positional argument = URL
      url = token
    }

    i++
  }

  if (!url) return null

  // Determine method
  if (isHead && !method) method = 'HEAD'
  if (!method) method = (hasData || hasForm) ? 'POST' : 'GET'

  // Parse query params from URL
  const params: KeyValuePair[] = []
  try {
    const urlObj = new URL(url)
    urlObj.searchParams.forEach((value, key) => {
      params.push(mkPair(key, value))
    })
    // Store URL without query string
    url = urlObj.origin + urlObj.pathname
  } catch {
    // URL might not be fully qualified, keep as-is
  }

  // Determine body type from Content-Type header
  const contentTypeHeader = headers.find(
    (h) => h.key.toLowerCase() === 'content-type'
  )
  const contentType = contentTypeHeader?.value.toLowerCase() ?? ''

  let body: RequestBody
  if (hasForm) {
    // Remove Content-Type header if it's multipart (will be set by fetch)
    const ctIdx = headers.findIndex(
      (h) => h.key.toLowerCase() === 'content-type' && h.value.toLowerCase().includes('multipart')
    )
    if (ctIdx >= 0) headers.splice(ctIdx, 1)

    body = { type: 'form-data', content: '', formData: formEntries }
  } else if (hasData) {
    let bodyType: BodyType = 'text'
    if (contentType.includes('json') || isJsonString(bodyContent)) {
      bodyType = 'json'
      // Pretty-print JSON if possible
      try {
        bodyContent = JSON.stringify(JSON.parse(bodyContent), null, 2)
      } catch { /* keep as-is */ }
    } else if (contentType.includes('x-www-form-urlencoded')) {
      bodyType = 'x-www-form-urlencoded'
      // Parse into form data entries
      const formData: KeyValuePair[] = []
      try {
        const searchParams = new URLSearchParams(bodyContent)
        searchParams.forEach((value, key) => {
          formData.push(mkPair(key, value))
        })
      } catch {
        formData.push(mkPair('', bodyContent))
      }
      body = { type: bodyType, content: '', formData }
      // Remove the Content-Type header since the body type selector handles it
      const ctIdx = headers.findIndex(
        (h) => h.key.toLowerCase() === 'content-type'
      )
      if (ctIdx >= 0) headers.splice(ctIdx, 1)

      // Add empty row at end
      params.push(mkPair('', ''))
      cookies.push(mkPair('', ''))
      headers.push(mkPair('', ''))

      return { method, url, headers, cookies, params, body }
    }

    body = { type: bodyType, content: bodyContent, formData: [] }
    // Remove Content-Type header for json since body type selector handles it
    if (bodyType === 'json') {
      const ctIdx = headers.findIndex(
        (h) => h.key.toLowerCase() === 'content-type'
      )
      if (ctIdx >= 0) headers.splice(ctIdx, 1)
    }
  } else {
    body = { type: 'none', content: '', formData: [] }
  }

  // Add an empty row at the end of each array (matches the app's UX pattern)
  params.push(mkPair('', ''))
  cookies.push(mkPair('', ''))
  headers.push(mkPair('', ''))

  return { method, url, headers, cookies, params, body }
}

function parseCookieString(cookieStr: string, cookies: KeyValuePair[]): void {
  const parts = cookieStr.split(';')
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx > 0) {
      cookies.push(mkPair(trimmed.slice(0, eqIdx).trim(), trimmed.slice(eqIdx + 1).trim()))
    }
  }
}

function looksLikeUrl(s: string): boolean {
  return /^https?:\/\//i.test(s) || s.includes('://') || s.includes('.')
}

function isJsonString(s: string): boolean {
  const trimmed = s.trim()
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
         (trimmed.startsWith('[') && trimmed.endsWith(']'))
}

/**
 * Quick check: does this string look like a curl command?
 */
export function isCurlCommand(text: string): boolean {
  const cleaned = text.trim().replace(/^\$\s*/, '')
  return /^curl\s/i.test(cleaned)
}
