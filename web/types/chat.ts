export interface Conversation {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

export interface Citation {
  index: number
  memory_id: string
  title: string
  similarity: number
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  citations: Citation[]
  created_at: string
}

export interface SendMessageRequest {
  conversation_id?: string
  content: string
}

export interface SendMessageResponse {
  message: Message
  citations: Citation[]
}

export interface ListConversationsResponse {
  conversations: Conversation[]
}

export interface ListMessagesResponse {
  messages: Message[]
}
