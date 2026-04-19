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

export interface AuthResponse {
  user: User
  token: TokenPair
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
    } else {
      localStorage.removeItem('echoes_token')
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
}

export const api = new ApiClient(API_BASE)
