import { describe, test, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { apiGet, apiPost, apiFetch, ApiError } from './client'

const server = setupServer(
  http.get('/api/test-endpoint', ({ request }) => {
    const url = new URL(request.url)
    const active = url.searchParams.get('active')
    const page = url.searchParams.get('page')
    
    return HttpResponse.json({ success: true, active, page })
  }),
  
  http.post('/api/post-endpoint', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ success: true, data: body })
  }),

  http.get('/api/error-endpoint', () => {
    return HttpResponse.json({ error: 'Invalid request' }, { status: 400 })
  }),

  http.get('/api/empty-error-endpoint', () => {
    return new HttpResponse(null, { status: 500 })
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('api/client.ts', () => {
  test('apiGet builds query parameters and filters out undefined or empty values', async () => {
    const res = await apiGet<{ success: boolean; active: string; page: string }>('/api/test-endpoint', {
      active: 1,
      page: '2',
      missing: undefined,
      empty: '',
    })

    expect(res.success).toBe(true)
    expect(res.active).toBe('1')
    expect(res.page).toBe('2')
  })

  test('apiPost sends JSON request body and returns JSON response', async () => {
    const res = await apiPost<{ success: boolean; data: any }>('/api/post-endpoint', {
      foo: 'bar',
    })

    expect(res.success).toBe(true)
    expect(res.data).toEqual({ foo: 'bar' })
  })

  test('apiFetch throws ApiError with JSON error field on non-ok status', async () => {
    try {
      await apiFetch('/api/error-endpoint')
      // If no error thrown, fail test
      expect(true).toBe(false)
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError)
      expect(err.message).toBe('Invalid request')
      expect(err.status).toBe(400)
    }
  })

  test('apiFetch throws ApiError with default status message on empty response error', async () => {
    try {
      await apiFetch('/api/empty-error-endpoint')
      expect(true).toBe(false)
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError)
      expect(err.message).toBe('HTTP 500')
      expect(err.status).toBe(500)
    }
  })
})
