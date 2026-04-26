# API 接口文档 (API)

> Echoes (拾忆) RESTful API 接口定义
> 版本：v1.2.0（对应 v1.2 "记忆的温度"）
> Base URL：`/api/v1`

## 通用规范

### 请求格式
- Content-Type: `application/json`
- 认证方式：Bearer Token（JWT）
- 时间格式：ISO 8601（`2026-04-18T12:00:00Z`）

### 响应格式

```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

### 错误格式

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数错误",
    "details": [ ... ]
  }
}
```

### HTTP 状态码

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 资源冲突 |
| 500 | 服务器内部错误 |

## 认证接口

### POST /auth/register
邮箱注册

**请求体：**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "username": "username"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "username",
      "created_at": "2026-04-18T12:00:00Z"
    },
    "token": {
      "access_token": "jwt_token",
      "refresh_token": "refresh_token",
      "expires_in": 900
    }
  }
}
```

### POST /auth/login
邮箱登录

**请求体：**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**响应：** 同注册响应

### GET /auth/providers
获取可用认证方式

**响应：**
```json
{
  "success": true,
  "data": {
    "providers": {
      "email": true,
      "github": true
    }
  }
}
```

- `github`: 当 `GITHUB_CLIENT_ID` 环境变量已配置时为 `true`，否则为 `false`
- 前端据此决定是否显示/禁用 GitHub 登录按钮

### GET /auth/github
GitHub OAuth 入口

- 重定向到 GitHub 授权页面
- 参数：`client_id`, `redirect_uri`, `scope`, `state`

**未配置时的响应（503）：**
```json
{
  "success": false,
  "error": {
    "code": "OAUTH_NOT_CONFIGURED",
    "message": "GitHub OAuth 未配置，请在环境变量中设置 GITHUB_CLIENT_ID 和 GITHUB_CLIENT_SECRET"
  }
}
```

### GET /auth/github/callback
GitHub OAuth 回调

**查询参数：**
- `code`: GitHub 授权码
- `state`: CSRF 防护状态码

**响应：**
- **浏览器端**：返回 HTML 页面，自动设置 `localStorage` token 并跳转至前端首页
- **API 调用**：同注册响应（JSON 格式，含 `user` + `token`）

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "username",
      "avatar_url": "https://...",
      "oauth_provider": "github",
      "is_active": true,
      "created_at": "2026-04-18T12:00:00Z"
    },
    "token": {
      "access_token": "jwt_token",
      "refresh_token": "refresh_token",
      "expires_in": 900
    }
  }
}
```

### POST /auth/refresh
刷新 Token

**请求体：**
```json
{
  "refresh_token": "refresh_token"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "access_token": "new_jwt_token",
    "expires_in": 900
  }
}
```

### POST /auth/logout
登出

**请求头：**
- `Authorization: Bearer {access_token}`

**响应：**
```json
{
  "success": true,
  "message": "登出成功"
}
```

### GET /auth/me
获取当前用户

**请求头：**
- `Authorization: Bearer {access_token}`

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "username",
    "avatar_url": "https://...",
    "created_at": "2026-04-18T12:00:00Z"
  }
}
```

## 记忆接口

### POST /memories
创建记忆

**请求头：**
- `Authorization: Bearer {access_token}`

**请求体：**
```json
{
  "content_type": "text",
  "text_content": "这是一段需要保存的文字内容 #标签1 #标签2",
  "tags": ["标签1", "标签2"],
  "note": "备注信息"
}
```

或链接类型：
```json
{
  "content_type": "link",
  "link_url": "https://example.com/article",
  "note": "备注信息"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "content_type": "text",
    "text_content": "这是一段需要保存的文字内容 #标签1 #标签2",
    "tags": ["标签1", "标签2"],
    "note": "备注信息",
    "processing_status": "pending",
    "created_at": "2026-04-18T12:00:00Z"
  }
}
```

### GET /memories
时间轴列表（分页）

**请求头：**
- `Authorization: Bearer {access_token}`

**查询参数：**
- `page`: 页码（默认 1）
- `limit`: 每页数量（默认 20，最大 100）
- `tag`: 标签筛选（可选）

**响应：**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "content_type": "text",
        "text_content": "...",
        "tags": ["标签1"],
        "processing_status": "completed",
        "created_at": "2026-04-18T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "has_more": true
    }
  }
}
```

### GET /memories/:id
记忆详情

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "content_type": "link",
    "link_url": "https://example.com",
    "link_title": "文章标题",
    "link_summary": "文章摘要...",
    "tags": ["技术", "Go"],
    "note": "值得参考",
    "processing_status": "completed",
    "created_at": "2026-04-18T12:00:00Z",
    "updated_at": "2026-04-18T12:00:00Z"
  }
}
```

### PUT /memories/:id
更新记忆（仅标签/备注）

**请求体：**
```json
{
  "tags": ["新标签1", "新标签2"],
  "note": "更新后的备注"
}
```

### DELETE /memories/:id
删除记忆

**响应：**
```json
{
  "success": true,
  "message": "删除成功"
}
```

### GET /memories/:id/related
相似内容推荐

**响应：**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "content_type": "text",
        "text_content": "...",
        "similarity_score": 0.92,
        "created_at": "2026-04-18T12:00:00Z"
      }
    ]
  }
}
```

## 搜索接口

### GET /search
语义搜索

**请求头：**
- `Authorization: Bearer {access_token}`

**查询参数：**
- `q`: 搜索查询（自然语言）
- `limit`: 返回数量（默认 10，最大 50）
- `tag`: 标签筛选（可选）

**响应：**
```json
{
  "success": true,
  "data": {
    "query": "如何学习 Go 语言",
    "items": [
      {
        "id": "uuid",
        "content_type": "link",
        "link_url": "https://...",
        "link_title": "Go 语言入门指南",
        "link_summary": "...",
        "tags": ["Go", "编程"],
        "similarity_score": 0.95,
        "created_at": "2026-04-18T12:00:00Z"
      }
    ]
  }
}
```

## WebSocket (预留)

### /ws/notifications
实时通知（处理状态更新）

**消息格式：**
```json
{
  "type": "processing_update",
  "memory_id": "uuid",
  "status": "completed",
  "timestamp": "2026-04-18T12:00:00Z"
}
```

## 健康检查

### GET /health
服务健康状态（各服务通用）

**响应：**
```json
{
  "status": "ok",
  "service": "gateway",
  "version": "0.2.0"
}
```

## 错误码对照表

| 错误码 | 描述 | HTTP 状态码 |
|--------|------|-------------|
| `VALIDATION_ERROR` | 请求参数验证失败 | 400 |
| `UNAUTHORIZED` | 未提供认证信息 | 401 |
| `TOKEN_EXPIRED` | Token 已过期 | 401 |
| `FORBIDDEN` | 无权限访问 | 403 |
| `NOT_FOUND` | 资源不存在 | 404 |
| `USER_EXISTS` | 用户已存在 | 409 |
| `INVALID_CREDENTIALS` | 用户名或密码错误 | 401 |
| `RATE_LIMITED` | 请求过于频繁 | 429 |
| `OAUTH_ERROR` | OAuth 授权失败（GitHub 返回错误） | 500 |
| `OAUTH_NOT_CONFIGURED` | GitHub OAuth 未配置（缺少环境变量） | 503 |
| `INVALID_STATE` | OAuth state 参数无效或过期 | 400 |
| `INTERNAL_ERROR` | 服务器内部错误 | 500 |
| `SERVICE_UNAVAILABLE` | 服务暂时不可用 | 503 |

---

## 接口概览（v1.0 ~ v1.2 新增）

以下接口已随 v1.0 MVP、v1.1 Echo Assistant、v1.2 "记忆的温度" 交付。详细参数定义和响应格式待后续补充。

### 记忆接口

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/memories` | 时间轴列表（分页：cursor / offset） |
| POST | `/api/v1/memories` | 创建记忆（文字 / 链接） |
| GET | `/api/v1/memories/:id` | 记忆详情 |
| PUT | `/api/v1/memories/:id` | 更新记忆 |
| DELETE | `/api/v1/memories/:id` | 删除记忆 |
| POST | `/api/v1/memories/:id/retry` | 重试失败任务 |

### 搜索接口

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/search` | 语义搜索（`?q=&limit=&threshold=`） |
| GET | `/api/v1/memories/:id/related` | 相似内容推荐 |

### 标签接口

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/tags` | 标签列表（含统计） |
| GET | `/api/v1/tags/:name` | 标签详情 |
| PUT | `/api/v1/tags/:name` | 更新标签（颜色等） |
| POST | `/api/v1/tags/merge` | 标签合并 |
| GET | `/api/v1/tags/:name/related` | 相关标签（共现统计） |
| GET | `/api/v1/memories/:id/related-tags` | 记忆相关标签 |

### AI 建议接口

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/memories/:id/suggestion` | 获取记忆的 AI 建议 |
| POST | `/api/v1/suggestions/:id/feedback` | 建议反馈（like / dislike） |

### 温暖功能接口

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/streaks` | 连续记录天数 |
| GET | `/api/v1/serendipity` | 那年今日 |
| GET | `/api/v1/daily-review` | 每日回顾 |
| GET | `/api/v1/capsules` | 时间胶囊列表 |
| POST | `/api/v1/capsules/:id/unlock` | 解锁时间胶囊 |

### Echo Assistant 接口

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/v1/chat` | 发送消息（RAG 问答） |
| GET | `/api/v1/chat/history` | 对话历史 |

### 用户设置接口

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/auth/me/settings` | 获取用户设置（LLM / 搜索 / 分页） |
| PUT | `/api/v1/auth/me/settings` | 更新用户设置 |

---

*API.md 最后更新：2026-04-26 — v1.2 接口概览已补充，详细定义待完善*
