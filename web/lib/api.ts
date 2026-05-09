// Echoes API client - centralized HTTP client for backend communication

import {
  SendMessageRequest,
  SendMessageResponse,
  ListConversationsResponse,
  ListMessagesResponse,
} from '@/types/chat'
import { ConstellationResponse, ExploreResponse } from '@/types/constellation'

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

export interface SearchSettings {
  similarity_threshold: number
}

export interface RAGSettings {
  rag_memory_limit: number
}

export interface AISettings {
  ai_suggestion_enabled?: boolean
  ai_suggestion_style?: 'gentle' | 'practical' | 'inspiring'
  ai_suggestion_timeout?: number
  ai_suggestion_max_retries?: number
}

export interface TagMeta {
  color?: string
}

export interface UserSettings extends LLMSettings {
  search_similarity_threshold?: number
  rag_memory_limit?: number
  pagination_mode?: 'load_more' | 'page_numbers'
  ai_suggestion_enabled?: boolean
  ai_suggestion_style?: 'gentle' | 'practical' | 'inspiring'
  ai_suggestion_timeout?: number
  ai_suggestion_max_retries?: number
  tag_metadata?: Record<string, TagMeta>
  tag_categories?: TagCategory[]
}

export interface UpdateSettingsRequest {
  llm?: LLMSettings
  search?: SearchSettings
  rag?: RAGSettings
  pagination?: { mode?: 'load_more' | 'page_numbers' }
  ai?: AISettings
  tags?: Record<string, TagMeta>
  tag_categories?: TagCategory[]
}

export interface AuthResponse {
  user: User
  token: TokenPair
}

export interface Memory {
  id: string
  user_id: string
  content_type: 'text' | 'link' | 'file'
  text_content?: string
  link_url?: string
  link_title?: string
  link_summary?: string
  tags: string[]
  note?: string
  source?: string
  is_starred?: boolean
  cover_url?: string
  file_name?: string
  file_size?: number
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  visibility: 'private' | 'public'
  sealed_until?: string
  created_at: string
  updated_at: string
}

export interface ListMemoriesResponse {
  memories: Memory[]
  total: number
  page: number
  limit: number
  has_more: boolean
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

export interface TagInfo {
  name: string
  count: number
  last_updated_at: string
  related_tags?: string[]
}

export interface TagListResponse {
  tags: TagInfo[]
}

export interface RelatedTagsResponse {
  tag: string
  related_tags: string[]
}

export interface SimilarTagsResponse {
  pairs: { canonical: string; duplicate: string }[]
}

export interface TagCategory {
  name: string
  tags: string[]
}

export interface CategorizeTagsResponse {
  categories: TagCategory[]
}

export interface AISuggestion {
  id: string
  memory_id: string
  content: string
  suggestion_type?: 'emotion_support' | 'knowledge_expand' | 'action_suggest' | 'connection' | 'general'
  created_at: string
  user_feedback?: 'liked' | 'disliked' | 'ignored'
}

export interface CreateMemoryResponse {
  memory: Memory
  suggestion_status: 'pending' | 'completed' | 'skipped' | 'failed'
}

export interface MemoryWithSuggestion extends Memory {
  suggestion?: AISuggestion
}

class ApiClient {
  private baseURL: string
  private token: string | null = null
  private refreshPromise: Promise<void> | null = null
  private onAuthErrorCallback: (() => void) | null = null

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  setOnAuthError(callback: () => void) {
    this.onAuthErrorCallback = callback
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

  private async doRefresh(): Promise<void> {
    const refreshToken = localStorage.getItem('echoes_refresh_token')
    if (!refreshToken) {
      throw new Error('No refresh token')
    }

    const response = await fetch(`${this.baseURL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    const data = await response.json() as ApiResponse<TokenPair>

    if (response.ok && data.success && data.data) {
      this.setToken(data.data.access_token)
      localStorage.setItem('echoes_refresh_token', data.data.refresh_token)
    } else {
      throw new Error(data.error?.message || 'Refresh failed')
    }
  }

  private async requestWithToken<T>(
    method: string,
    path: string,
    body?: unknown,
    signal?: AbortSignal,
    isFormData?: boolean
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${path}`
    const headers: Record<string, string> = {}

    if (!isFormData) {
      headers['Content-Type'] = 'application/json'
    }

    const token = this.getToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const options: RequestInit = {
      method,
      headers,
      signal,
    }

    if (body) {
      if (isFormData && body instanceof FormData) {
        options.body = body
      } else {
        options.body = JSON.stringify(body)
      }
    }

    const response = await fetch(url, options)
    const data = await response.json() as ApiResponse<T>

    if (!response.ok && !data.success) {
      throw new Error(data.error?.message || 'Request failed')
    }

    return data
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    signal?: AbortSignal,
    isFormData?: boolean
  ): Promise<ApiResponse<T>> {
    try {
      return await this.requestWithToken<T>(method, path, body, signal, isFormData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : ''
      // Check if this is an auth error (401 / TOKEN_EXPIRED / UNAUTHORIZED)
      const isAuthError =
        errorMessage.includes('TOKEN_EXPIRED') ||
        errorMessage.includes('UNAUTHORIZED') ||
        errorMessage.includes('Invalid or expired token') ||
        errorMessage.includes('token')

      if (!isAuthError) {
        throw err
      }

      // Try refresh
      if (!this.refreshPromise) {
        this.refreshPromise = this.doRefresh().finally(() => {
          this.refreshPromise = null
        })
      }

      try {
        await this.refreshPromise
        // Retry original request
        return await this.requestWithToken<T>(method, path, body, signal, isFormData)
      } catch {
        // Refresh failed — clear auth state and notify
        this.setToken(null)
        this.onAuthErrorCallback?.()
        throw new Error('登录已过期，请重新登录')
      }
    }
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
  async getSettings(): Promise<ApiResponse<UserSettings>> {
    return this.request<UserSettings>('GET', '/api/v1/auth/me/settings')
  }

  async updateSettings(settings: UpdateSettingsRequest): Promise<ApiResponse<UserSettings>> {
    return this.request<UserSettings>('PUT', '/api/v1/auth/me/settings', settings)
  }

  async testLLMConnection(settings: { llm: LLMSettings }): Promise<ApiResponse<unknown>> {
    return this.request<unknown>('POST', '/api/v1/auth/me/settings/test', settings)
  }

  // Memory endpoints
  async createMemory(data: FormData | {
    content_type: 'text' | 'link' | 'file'
    text_content?: string
    link_url?: string
    tags?: string[]
    note?: string
    source?: string
    is_starred?: boolean
    enable_ai_suggestion?: boolean
  }): Promise<ApiResponse<CreateMemoryResponse>> {
    const isFormData = data instanceof FormData
    return this.request<CreateMemoryResponse>('POST', '/api/v1/memories', data, undefined, isFormData)
  }

  async listMemories(params?: { page?: number; limit?: number; tag?: string; tags?: string[]; starred?: boolean }): Promise<ApiResponse<ListMemoriesResponse>> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.tag) searchParams.set('tag', params.tag)
    if (params?.tags) {
      params.tags.forEach(tag => searchParams.append('tags', tag))
    }
    if (params?.starred) searchParams.set('starred', 'true')
    const query = searchParams.toString()
    return this.request<ListMemoriesResponse>('GET', `/api/v1/memories${query ? '?' + query : ''}`)
  }

  async getMemory(id: string): Promise<ApiResponse<Memory>> {
    return this.request<Memory>('GET', `/api/v1/memories/${id}`)
  }

  async updateMemory(id: string, data: { tags?: string[]; note?: string; source?: string; is_starred?: boolean }): Promise<ApiResponse<Memory>> {
    return this.request<Memory>('PUT', `/api/v1/memories/${id}`, data)
  }

  async deleteMemory(id: string): Promise<ApiResponse<unknown>> {
    return this.request<unknown>('DELETE', `/api/v1/memories/${id}`)
  }

  async searchMemories(params: { q: string; limit?: number }, signal?: AbortSignal): Promise<ApiResponse<SearchResponse>> {
    const searchParams = new URLSearchParams()
    searchParams.set('q', params.q)
    if (params.limit) searchParams.set('limit', String(params.limit))
    return this.request<SearchResponse>('GET', `/api/v1/search?${searchParams.toString()}`, undefined, signal)
  }

  async getRelatedMemories(id: string, params?: { limit?: number }): Promise<ApiResponse<RelatedResponse>> {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.set('limit', String(params.limit))
    const query = searchParams.toString()
    return this.request<RelatedResponse>('GET', `/api/v1/memories/${id}/related${query ? '?' + query : ''}`)
  }

  // AI Suggestion endpoints
  async getSuggestion(memoryId: string): Promise<ApiResponse<AISuggestion>> {
    return this.request<AISuggestion>('GET', `/api/v1/memories/${memoryId}/suggestion`)
  }

  async updateSuggestionFeedback(memoryId: string, feedback: 'liked' | 'disliked' | 'ignored'): Promise<ApiResponse<unknown>> {
    return this.request<unknown>('PATCH', `/api/v1/memories/${memoryId}/suggestion/feedback`, {
      user_feedback: feedback,
    })
  }

  // Tag endpoints
  async getTags(): Promise<ApiResponse<TagListResponse>> {
    return this.request<TagListResponse>('GET', '/api/v1/tags')
  }

  async getRelatedTags(tag: string): Promise<ApiResponse<RelatedTagsResponse>> {
    return this.request<RelatedTagsResponse>('GET', `/api/v1/tags/${encodeURIComponent(tag)}/related`)
  }

  async mergeTags(sourceTag: string, targetTag: string): Promise<ApiResponse<{ affected: number }>> {
    return this.request<{ affected: number }>('POST', '/api/v1/tags/merge', {
      source_tag: sourceTag,
      target_tag: targetTag,
    })
  }

  async getSimilarTags(): Promise<ApiResponse<SimilarTagsResponse>> {
    return this.request<SimilarTagsResponse>('GET', '/api/v1/tags/similar')
  }

  async categorizeTags(): Promise<ApiResponse<CategorizeTagsResponse>> {
    return this.request<CategorizeTagsResponse>('POST', '/api/v1/tags/categorize')
  }

  // Time capsule endpoints
  async sealMemory(id: string, sealedUntil: string): Promise<ApiResponse<unknown>> {
    return this.request<unknown>('POST', `/api/v1/memories/${id}/seal`, { sealed_until: sealedUntil })
  }

  async unsealMemory(id: string): Promise<ApiResponse<unknown>> {
    return this.request<unknown>('DELETE', `/api/v1/memories/${id}/seal`)
  }

  async listSealedMemories(params?: { page?: number; limit?: number }): Promise<ApiResponse<ListMemoriesResponse>> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    const query = searchParams.toString()
    return this.request<ListMemoriesResponse>('GET', `/api/v1/memories/sealed${query ? '?' + query : ''}`)
  }

  async getRecentlyUnsealed(): Promise<ApiResponse<{ memories: Memory[] }>> {
    return this.request<{ memories: Memory[] }>('GET', '/api/v1/memories/unsealed')
  }

  // Warmth endpoints
  async getStreaks(): Promise<ApiResponse<{ current_streak: number; longest_streak: number; has_recorded_today: boolean }>> {
    return this.request<{ current_streak: number; longest_streak: number; has_recorded_today: boolean }>('GET', '/api/v1/memories/streaks')
  }

  async getSerendipity(): Promise<ApiResponse<{ memory: Memory; memories_since: number; years_ago: number }>> {
    return this.request<{ memory: Memory; memories_since: number; years_ago: number }>('GET', '/api/v1/memories/serendipity')
  }

  async getDailyReview(): Promise<ApiResponse<{ today_count: number; top_tags: string[]; worth_reviewing?: Memory }>> {
    return this.request<{ today_count: number; top_tags: string[]; worth_reviewing?: Memory }>('GET', '/api/v1/memories/daily-review')
  }

  // Chat endpoints
  async sendMessage(data: SendMessageRequest): Promise<ApiResponse<SendMessageResponse>> {
    return this.request<SendMessageResponse>('POST', '/api/v1/chat/messages', data)
  }

  async listConversations(): Promise<ApiResponse<ListConversationsResponse>> {
    return this.request<ListConversationsResponse>('GET', '/api/v1/chat/conversations')
  }

  async deleteConversation(id: string): Promise<ApiResponse<unknown>> {
    return this.request<unknown>('DELETE', `/api/v1/chat/conversations/${id}`)
  }

  async getMessages(conversationId: string): Promise<ApiResponse<ListMessagesResponse>> {
    return this.request<ListMessagesResponse>('GET', `/api/v1/chat/conversations/${conversationId}/messages`)
  }

  // Constellation endpoints
  async getConstellation(offset: number = 0): Promise<ApiResponse<ConstellationResponse>> {
    return this.request<ConstellationResponse>('GET', `/api/v1/constellation?offset=${offset}`)
  }

  async exploreMemory(id: string): Promise<ApiResponse<ExploreResponse>> {
    return this.request<ExploreResponse>('GET', `/api/v1/memories/${id}/explore`)
  }
}

export const api = new ApiClient(API_BASE)
