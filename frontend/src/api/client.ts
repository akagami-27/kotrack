const API_URL =
  import.meta.env.VITE_API_URL ??
  ''

const TOKEN_KEY =
  'kotrack_access_token'


export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token =
    localStorage.getItem(TOKEN_KEY)

  const headers =
    new Headers(options.headers)

  // Only set JSON content type when a body exists
  // and the caller hasn't already provided one.
  if (
    options.body &&
    !headers.has('Content-Type')
  ) {
    headers.set(
      'Content-Type',
      'application/json',
    )
  }

  if (token) {
    headers.set(
      'Authorization',
      `Bearer ${token}`,
    )
  }

  let response: Response

  try {
    response = await fetch(
      `${API_URL}${path}`,
      {
        ...options,
        headers,
      },
    )
  } catch {
    throw new Error(
      'Unable to connect to KoTrack server. Please make sure the backend is running.',
    )
  }

  // --------------------------------------------------------------------------
  // Handle expired/invalid authentication
  // --------------------------------------------------------------------------

  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY)

    throw new Error(
      'Your session has expired. Please sign in again.',
    )
  }

  // --------------------------------------------------------------------------
  // Parse response safely
  // --------------------------------------------------------------------------

  const contentType =
    response.headers.get('content-type') || ''

  let data: unknown = null

  if (
    contentType.includes(
      'application/json',
    )
  ) {
    data = await response
      .json()
      .catch(() => null)
  } else {
    data = await response
      .text()
      .catch(() => null)
  }

  // --------------------------------------------------------------------------
  // Handle API errors
  // --------------------------------------------------------------------------

  if (!response.ok) {
    let message =
      `Request failed with status ${response.status}`

    if (
      data &&
      typeof data === 'object' &&
      'detail' in data
    ) {
      const detail =
        (data as {
          detail?: unknown
        }).detail

      if (typeof detail === 'string') {
        message = detail
      } else if (
        Array.isArray(detail)
      ) {
        message = detail
          .map((item) => {
            if (
              item &&
              typeof item === 'object' &&
              'msg' in item
            ) {
              return String(
                (item as {
                  msg: unknown
                }).msg,
              )
            }

            return String(item)
          })
          .join(', ')
      }
    }

    throw new Error(message)
  }

  // --------------------------------------------------------------------------
  // Empty responses
  // --------------------------------------------------------------------------

  if (
    response.status === 204 ||
    data === null ||
    data === ''
  ) {
    return undefined as T
  }

  return data as T
}