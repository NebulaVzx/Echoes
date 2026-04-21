// Echoes API client - centralized HTTP client for backend communication

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8088'

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
  message?: string
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  expires_in: number
}

export interface User {
  id: string
  email: string
  username: string
  avatar_url?: string
  oauth_provider?: string
  is_active: boolean
  created_at: string
}

export interface LLMSettings {
  llm_provider: string
  llm_protocol?: string
  llm_model: string
  llm_temperature: number
  api_key?: string
  base_url?: string
  include_note_in_analysis?: boolean
}

export interface UpdateSettingsRequest {
  llm: LLMSettings
}

export interface AuthResponse {
  user: User
  token: TokenPair
}

export interface Memory {
  id: string
  user_id: string
  content_type: 'text' | 'link'
  text_content?: string
  link_url?: string
  link_title?: string
  link_summary?: string
  tags: string[]
  note?: string
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  visibility: 'private' | 'public'
  created_at: string
  updated_at: string
}

export interface ListMemoriesResponse {
  memories: Memory[]
  total: number
  page: number
  limit: number
}

export interface SearchResult extends Memory {
  similarity: number
}

export interface SearchResponse {
  results: SearchResult[]
  query: string
}

export interface RelatedResponse {
  results: SearchResult[]
  memory_id: string
}

class ApiClient {
  private baseURL: string
  private token: string | null = null

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  setToken(token: string | null) {
    this.token = token
    if (token) {
      localStorage.setItem('echoes_token', token)
      // Also set cookie for Next.js middleware (15 min expiry)
      document.cookie = `echoes_token=${encodeURIComponent(token)}; path=/; max-age=900; SameSite=Lax`
    } else {
      localStorage.removeItem('echoes_token')
      localStorage.removeItem('echoes_refresh_token')
      // Clear cookies
      document.cookie = 'echoes_token=; path=/; max-age=0'
      document.cookie = 'echoes_refresh_token=; path=/; max-age=0'
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('echoes_token')
    }
    return this.token
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    const token = this.getToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const options: RequestInit = {
      method,
      headers,
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)
    const data = await response.json()

    if (!response.ok && !data.success) {
      throw new Error(data.error?.message || 'Request failed')
    }

    return data
  }

  // Auth endpoints
  async register(email: string, password: string, username: string): Promise<ApiResponse<AuthResponse>> {
    return this.request<AuthResponse>('POST', '/api/v1/auth/register', {
      email,
      password,
      username,
    })
  }

  async login(email: string, password: string): Promise<ApiResponse<AuthResponse>> {
    return this.request<AuthResponse>('POST', '/api/v1/auth/login', {
      email,
      password,
    })
  }

  async refreshToken(refreshToken: string): Promise<ApiResponse<TokenPair>> {
    return this.request<TokenPair>('POST', '/api/v1/auth/refresh', {
      refresh_token: refreshToken,
    })
  }

  async logout(): Promise<ApiResponse<unknown>> {
    const result = await this.request<unknown>('POST', '/api/v1/auth/logout')
    this.setToken(null)
    return result
  }

  async getMe(): Promise<ApiResponse<User>> {
    return this.request<User>('GET', '/api/v1/auth/me')
  }

  // Settings endpoints
  async getSettings(): Promise<ApiResponse<LLMSettings>> {
    return this.request<LLMSettings>('GET', '/api/v1/auth/me/settings')
  }

  async updateSettings(settings: UpdateSettingsRequest): Promise<ApiResponse<LLMSettings>> {
    return this.request<LLMSettings>('PUT', '/api/v1/auth/me/settings', settings)
  }

  async testLLMConnection(settings: UpdateSettingsRequest): Promise<ApiResponse<unknown>> {
    return this.request<unknown>('POST', '/api/v1/auth/me/settings/test', settings)
  }

  // Memory endpoints
  async createMemory(data: {
    content_type: 'text' | 'link'
    text_content?: string
    link_url?: string
    tags?: string[]
    note?: string
  }): Promise<ApiResponse<Memory>> {
    return this.request<Memory>('POST', '/api/v1/memories', data)
  }

  async listMemories(params?: { page?: number; limit?: number; tag?: string }): Promise<ApiResponse<ListMemoriesResponse>> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.tag) searchParams.set('tag', params.tag)
    const query = searchParams.toString()
    return this.request<ListMemoriesResponse>('GET', `/api/v1/memories${query ? '?' + query : ''}`)
  }

  async getMemory(id: string): Promise<ApiResponse<Memory>> {
    return this.request<Memory>('GET', `/api/v1/memories/${id}`)
  }

  async updateMemory(id: string, data: { tags?: string[]; note?: string }): Promise<ApiResponse<Memory>> {
    return this.request<Memory>('PUT', `/api/v1/memories/${id}`, data)
  }

  async deleteMemory(id: string): Promise<ApiResponse<unknown>> {
    return this.request<unknown>('DELETE', `/api/v1/memories/${id}`)
  }

  async searchMemories(params: { q: string; limit?: number }): Promise<ApiResponse<SearchResponse>> {
    const searchParams = new URLSearchParams()
    searchParams.set('q', params.q)
    if (params.limit) searchParams.set('limit', String(params.limit))
    return this.request<SearchResponse>('GET', `/api/v1/search?${searchParams.toString()}`)
  }

  async getRelatedMemories(id: string, params?: { limit?: number }): Promise<ApiResponse<RelatedResponse>> {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.set('limit', String(params.limit))
    const query = searchParams.toString()
    return this.request<RelatedResponse>('GET', `/api/v1/memories/${id}/related${query ? '?' + query : ''}`)
  }
}

export const api = new ApiClient(API_BASE)
