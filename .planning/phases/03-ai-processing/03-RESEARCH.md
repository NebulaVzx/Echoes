# Phase 3: AI Processing Layer - Research

**Researched:** 2026-04-19
**Domain:** Python FastAI + Redis Streams + LLM Integration + Vector Embeddings
**Confidence:** HIGH

## Summary

Phase 3 implements the AI processing layer for Echoes: Processor Service (link scraping + auto-tagging) and Vectorizer Service (BGE-M3 embeddings). Both services consume tasks from Redis Streams using Consumer Groups for reliable at-least-once delivery. The architecture follows a strict separation: Processor/Vectorizer are pure consumers that call back to Memory Service via internal API to update state. No direct database access from Python services.

Key technical decisions verified through research:
1. **BGE-M3 outputs 1024 dimensions**, not 768. The database schema already defines `VECTOR(768)` which is a mismatch. The project PRD and migration specify 768-dim, but BGE-M3 natively produces 1024-dim vectors. Two options: (a) use a different 768-dim model like `BAAI/bge-small-zh-v1.5`, or (b) update schema to `VECTOR(1024)`. Given the PRD explicitly says BGE-M3, the schema must be updated. [VERIFIED: Context7 sentence-transformers docs + WebSearch]
2. **Redis Stream Consumer Groups** provide the exact semantics needed: XREADGROUP for delivery, XACK for confirmation, XAUTOCLAIM for stale message recovery. redis-py 5.x supports all these APIs natively. [VERIFIED: Context7 Redis docs + redis-py docs]
3. **LLM Provider abstraction** should use `openai>=1.0` (async client) and `anthropic>=0.30` (async client) with a simple factory pattern. Total code ~200 lines as specified in CLAUDE.md. [VERIFIED: pip registry + WebSearch]
4. **FastAPI lifespan** is the correct pattern for starting background consumers. Use `asyncio.create_task()` in lifespan startup, cancel + await in shutdown. Block timeout of 1-2 seconds ensures responsive shutdown. [VERIFIED: Context7 FastAPI docs + WebSearch]

**Primary recommendation:** Update migration to `VECTOR(1024)` to match BGE-M3 output, implement Redis Consumer Group consumers in lifespan managers, build lightweight LLM factory with async clients, and implement sub-task state tracking in JSONB with aggregation logic in Memory Service.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| BGE-M3 inference | Vectorizer Service (Python) | — | Model runs in Python, GPU/CPU bound |
| LLM tag generation | Processor Service (Python) | — | LLM calls from Python with async HTTP |
| Link scraping | Processor Service (Python) | — | httpx + BeautifulSoup in Python |
| Redis Stream consumption | Processor/Vectorizer (Python) | — | Consumer groups in each service |
| Sub-task state tracking | Memory Service (Go) | — | JSONB metadata owned by Memory Service |
| State aggregation | Memory Service (Go) | — | Business logic in Go service layer |
| Internal status API | Memory Service (Go) | — | PATCH endpoint in Go transport layer |
| Task publishing | Memory Service (Go) | — | Already implemented in RedisTaskQueue |

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** No LLM fallback — accurate errors only
- **D-02:** Core dependency AI capability — TF-IDF/jieba not used
- **D-03:** LLM configurable via env vars (provider, model, temperature)
- **D-04:** LLM status monitoring needed (call success rate, latency)
- **D-05:** Prompt engineering — 3-5 Chinese tags, prompt configurable
- **D-06:** Link scraping extracts full content, not just title/meta
- **D-07:** Content summary via LLM, not truncation
- **D-08:** httpx with reasonable User-Agent, timeout, retry; 403/429 logged not blocking
- **D-09:** Redis Stream Consumer Group for reliable consumption
- **D-10:** Each service independent Consumer Group
- **D-11:** Message ACK after success, no ACK on failure (retain in Pending)
- **D-12:** Processor/Vectorizer call Memory Service internal API, no direct DB
- **D-13:** Sub-task state tracking in metadata JSONB field
- **D-14:** Aggregated status: all success=completed, mixed=partial_failed, all failed=failed
- **D-15:** User can retry individual failed sub-tasks
- **D-16:** Auto-retry 3 times with exponential backoff, then mark failed

### Claude's Discretion
- BGE-M3 model loading strategy (startup preloading vs lazy loading) → **Research recommends: startup preloading**
- LLM Provider abstract layer specific interface design → **Research recommends: async abstract base class with factory**
- Processor internal task scheduling details → **Research recommends: one consumer loop per stream, sequential processing**
- Internal API specific path and authentication → **Research recommends: `PATCH /api/v1/internal/memories/:id/tasks` with service-to-service token**

### Deferred Ideas (OUT OF SCOPE)
- LLM configuration UI complete design — Sprint 4/5
- Link scraping advanced features (PDF, video) — Phase 2
- Multimodal content (image OCR) — explicitly out
- Advanced retry (dead letter queue) — if time permits

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R2.5 | Auto-trigger link fetch (title, summary) | httpx + BeautifulSoup consumer on `link:fetch` stream |
| R2.6 | Link type also vectorized | Processor publishes derived content for vectorization, or Memory Service publishes both |
| R2.7 | LLM auto-generate 3-5 Chinese tags | LLM Provider abstraction with configurable prompt |
| R5.1 | Unified interface `GenerateTags(content string) ([]string, error)` | Abstract base class + concrete implementations |
| R5.2 | OpenAI/Anthropic switch via `LLM_PROVIDER` env | Factory pattern with env-driven config |
| R5.3 | Factory pattern create Provider instance | Registry-based factory ~50 lines |
| R5.4 | Auto-publish 3 Redis Stream tasks on memory create | Already implemented in MemoryService.publishTasks |
| R5.5 | Task types: `link:fetch`, `text:vectorize`, `tag:generate` | Stream names already defined |
| R5.6 | Status flow: pending → processing → completed/failed | Sub-task JSONB tracking + aggregation logic |
| R5.7 | Failed tasks retry max 3 times | Exponential backoff in consumer, retry count in Redis stream ID or metadata |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sentence-transformers | 2.5.1 (current) / 5.4.1 (latest) | BGE-M3 model loading, inference | De facto standard for sentence embeddings [VERIFIED: pip registry] |
| torch | 2.2.1 (current) | PyTorch backend for transformers | Required by sentence-transformers [VERIFIED: requirements.txt] |
| transformers | 4.38.2 (current) | HuggingFace model hub integration | Required by sentence-transformers [VERIFIED: requirements.txt] |
| openai | 1.68.0+ (latest stable) | OpenAI API async client | Modern async API, v1.x complete rewrite [VERIFIED: pip registry] |
| anthropic | 0.96.0 (latest) | Anthropic API async client | Official SDK, async support [VERIFIED: pip registry] |
| redis-py | 5.0.3 (current) / 7.4.0 (latest) | Redis Stream Consumer Group APIs | Official Python client, supports XREADGROUP/XACK/XAUTOCLAIM [VERIFIED: pip registry] |
| httpx | 0.27.0 (current) / 0.28.1 (latest) | Async HTTP for link scraping | Modern async HTTP/2 support [VERIFIED: pip registry] |
| beautifulsoup4 | 4.12.3 (current) / 4.14.3 (latest) | HTML parsing for content extraction | Standard HTML parser [VERIFIED: pip registry] |
| lxml | 5.1.0 (current) / 6.1.0 (latest) | Fast XML/HTML parser backend | Required by BeautifulSoup for speed [VERIFIED: pip registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| numpy | 1.26.4 (current) | Vector array handling | Required by sentence-transformers |
| pydantic | 2.6.4 (current) | Config validation, API models | Already in requirements.txt |
| python-multipart | 0.0.9 (current) | FastAPI form parsing | Already in requirements.txt |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sentence-transformers 2.5.1 | sentence-transformers 5.4.1 | 5.x has better performance but may have API changes; 2.5.1 is tested stable |
| BGE-M3 (1024d) | bge-small-zh-v1.5 (768d) | Small model fits existing schema but lower quality; BGE-M3 is explicitly required |
| httpx | aiohttp | httpx has better HTTP/2 and is already in requirements.txt |
| redis-py XAUTOCLAIM | Manual XPENDING+XCLAIM | XAUTOCLAIM is cleaner but requires Redis 6.2+ (Redis 7 is used, so OK) |

**Installation (update requirements.txt):**
```bash
# Processor Service additions
openai>=1.68.0
anthropic>=0.30.0

# Vectorizer Service - already has torch/transformers/sentence-transformers
# No additions needed
```

**Version verification:**
- `openai`: 2.32.0 available (latest as of 2026-04-19) [VERIFIED: pip index]
- `anthropic`: 0.96.0 available (latest as of 2026-04-19) [VERIFIED: pip index]
- `sentence-transformers`: 5.4.1 available, project uses 2.5.1 [VERIFIED: pip index]
- `redis`: 7.4.0 available, project uses 5.0.3 [VERIFIED: pip index]
- `httpx`: 0.28.1 available, project uses 0.27.0 [VERIFIED: pip index]

## Architecture Patterns

### System Architecture Diagram

```
+--------------------------------------------------+
|                  Memory Service (Go)               |
|  +---------------------------------------------+  |
|  |  publishTasks()                             |  |
|  |  - XADD link:fetch    {memory_id, link_url} |  |
|  |  - XADD text:vectorize {memory_id, content} |  |
|  |  - XADD tag:generate  {memory_id, content}  |  |
|  +---------------------------------------------+  |
|  +---------------------------------------------+  |
|  |  PATCH /api/v1/internal/memories/:id/tasks  |  |
|  |  - Update sub-task status in JSONB          |  |
|  |  - Recompute aggregated status              |  |
|  +---------------------------------------------+  |
+--------------------------------------------------+
          |                    |                    |
          v                    v                    v
   +-------------+     +-------------+     +----------------+
   | link:fetch  |     |text:vectorize|    | tag:generate   |
   |   Stream    |     |   Stream     |    |    Stream      |
   +-------------+     +-------------+     +----------------+
          |                    |                    |
          v                    v                    v
+-----------------------------------------------------------+
|              Processor Service (Python/FastAPI)           |
|  +-------------------+     +-------------------------+   |
|  | Link Consumer     |     | Tag Consumer            |   |
|  | (Consumer Group)  |     | (Consumer Group)        |   |
|  | - XREADGROUP      |     | - XREADGROUP            |   |
|  | - httpx fetch     |     | - LLM.generate()        |   |
|  | - BeautifulSoup   |     | - XACK on success       |   |
|  | - LLM summarize   |     | - retry with backoff    |   |
|  | - XACK on success |     |                         |   |
|  +-------------------+     +-------------------------+   |
|  +---------------------------------------------------+   |
|  | LLM Provider (Factory)                            |   |
|  | - OpenAIModel (openai.AsyncOpenAI)                |   |
|  | - AnthropicModel (anthropic.AsyncAnthropic)       |   |
|  +---------------------------------------------------+   |
+-----------------------------------------------------------+
                              |
                              v
+-----------------------------------------------------------+
|              Vectorizer Service (Python/FastAPI)          |
|  +---------------------------------------------------+   |
|  | Vectorize Consumer (Consumer Group)               |   |
|  | - XREADGROUP text:vectorize stream                |   |
|  | - model.encode(content) -> 1024d vector           |   |
|  | - Call Memory Service to store vector             |   |
|  | - XACK on success                                 |   |
|  +---------------------------------------------------+   |
|  +---------------------------------------------------+   |
|  | BGE-M3 Model (loaded at startup)                  |   |
|  | - SentenceTransformer("BAAI/bge-m3")              |   |
|  | - Device: auto (CUDA if available)                |   |
|  +---------------------------------------------------+   |
+-----------------------------------------------------------+
```

### Recommended Project Structure

```
services/processor-service/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app + lifespan
│   ├── config.py            # Settings (LLM_PROVIDER, API keys, etc.)
│   ├── consumers/
│   │   ├── __init__.py
│   │   ├── base.py          # Abstract consumer class
│   │   ├── link_consumer.py # link:fetch consumer
│   │   └── tag_consumer.py  # tag:generate consumer
│   ├── services/
│   │   ├── __init__.py
│   │   ├── scraper.py       # httpx + BeautifulSoup link scraping
│   │   └── llm/
│   │       ├── __init__.py
│   │       ├── base.py      # Abstract LLM provider
│   │       ├── factory.py   # Provider factory
│   │       ├── openai_provider.py
│   │       └── anthropic_provider.py
│   └── clients/
│       └── memory_client.py # HTTP client for Memory Service internal API
├── requirements.txt
└── Dockerfile

services/vectorizer-service/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app + lifespan
│   ├── config.py            # Settings
│   ├── consumers/
│   │   ├── __init__.py
│   │   ├── base.py
│   │   └── vectorize_consumer.py  # text:vectorize consumer
│   ├── services/
│   │   ├── __init__.py
│   │   └── embedder.py      # BGE-M3 wrapper
│   └── clients/
│       └── memory_client.py # HTTP client for Memory Service internal API
├── requirements.txt
└── Dockerfile
```

### Pattern 1: Redis Stream Consumer Base Class
**What:** Abstract base for all Redis Stream consumers with common lifecycle, ACK, retry logic.
**When to use:** All three consumer implementations (link, tag, vectorize).
**Example:**
```python
# Source: Context7 Redis docs + redis-py docs + WebSearch verified patterns
import asyncio
import redis.asyncio as redis
from abc import ABC, abstractmethod
from datetime import datetime

class RedisStreamConsumer(ABC):
    def __init__(self, redis_client: redis.Redis, stream: str, group: str,
                 consumer: str, max_retries: int = 3):
        self.redis = redis_client
        self.stream = stream
        self.group = group
        self.consumer = consumer
        self.max_retries = max_retries
        self._shutdown = asyncio.Event()
        self._task = None

    async def start(self):
        try:
            await self.redis.xgroup_create(
                name=self.stream, groupname=self.group,
                id="0", mkstream=True
            )
        except redis.ResponseError as e:
            if "BUSYGROUP" not in str(e):
                raise
        self._task = asyncio.create_task(self._run())

    async def _run(self):
        while not self._shutdown.is_set():
            try:
                messages = await self.redis.xreadgroup(
                    groupname=self.group, consumername=self.consumer,
                    streams={self.stream: ">"},
                    count=1, block=2000
                )
                for stream_name, entries in messages:
                    for msg_id, fields in entries:
                        if self._shutdown.is_set():
                            break
                        await self._process_with_retry(msg_id, fields)
            except asyncio.CancelledError:
                break
            except Exception:
                await asyncio.sleep(1)

    async def _process_with_retry(self, msg_id: str, fields: dict):
        retry_count = int(fields.get("retry_count", 0))
        for attempt in range(retry_count, self.max_retries):
            try:
                await self.process_message(msg_id, fields)
                await self.redis.xack(self.stream, self.group, msg_id)
                return
            except Exception as e:
                if attempt == self.max_retries - 1:
                    await self._report_failure(msg_id, fields, str(e))
                    # Do NOT ack — keep in pending for manual retry
                    return
                wait = 2 ** attempt  # 1, 2, 4 seconds
                await asyncio.sleep(wait)

    @abstractmethod
    async def process_message(self, msg_id: str, fields: dict):
        pass

    async def _report_failure(self, msg_id: str, fields: dict, error: str):
        # Call Memory Service internal API to report failure
        pass

    async def stop(self):
        self._shutdown.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
```

### Pattern 2: FastAPI Lifespan with Multiple Consumers
**What:** Start multiple consumer background tasks in lifespan, gracefully shutdown on exit.
**When to use:** Both Processor and Vectorizer services.
**Example:**
```python
# Source: Context7 FastAPI docs + WebSearch graceful shutdown patterns
from contextlib import asynccontextmanager
from fastapi import FastAPI
import redis.asyncio as redis

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    redis_client = redis.Redis.from_url(
        os.getenv("REDIS_URL", "redis://redis:6379/0"),
        decode_responses=True
    )
    await redis_client.ping()

    # Start consumers
    consumers = []
    if os.getenv("ENABLE_LINK_CONSUMER", "true") == "true":
        link_consumer = LinkConsumer(redis_client, ...)
        await link_consumer.start()
        consumers.append(link_consumer)

    if os.getenv("ENABLE_TAG_CONSUMER", "true") == "true":
        tag_consumer = TagConsumer(redis_client, ...)
        await tag_consumer.start()
        consumers.append(tag_consumer)

    app.state.redis = redis_client
    app.state.consumers = consumers

    yield  # Application runs

    # Shutdown
    for consumer in consumers:
        await consumer.stop()
    await redis_client.aclose()

app = FastAPI(lifespan=lifespan)
```

### Pattern 3: LLM Provider Factory
**What:** Abstract base class + factory for OpenAI/Anthropic switching.
**When to use:** Processor Service tag generation and link summarization.
**Example:**
```python
# Source: WebSearch verified patterns + official SDK docs
from abc import ABC, abstractmethod
from typing import List
import os

class LLMProvider(ABC):
    @abstractmethod
    async def generate(self, prompt: str, temperature: float = 0.7,
                       max_tokens: int = 500) -> str:
        pass

    @abstractmethod
    async def generate_tags(self, content: str) -> List[str]:
        """Generate 3-5 Chinese tags."""
        pass

class OpenAIProvider(LLMProvider):
    def __init__(self, model: str = "gpt-4o-mini", api_key: str = None):
        from openai import AsyncOpenAI
        self.client = AsyncOpenAI(api_key=api_key or os.getenv("OPENAI_API_KEY"))
        self.model = model

    async def generate(self, prompt: str, temperature: float = 0.7,
                       max_tokens: int = 500) -> str:
        resp = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=max_tokens
        )
        return resp.choices[0].message.content

    async def generate_tags(self, content: str) -> List[str]:
        prompt = f"""Based on the following content, generate 3-5 concise Chinese tags (each 2-6 characters).
Tags should be nouns or noun phrases that capture key topics.
Output format: comma-separated list only, no explanation.

Content: {content[:2000]}"""
        result = await self.generate(prompt, temperature=0.3, max_tokens=100)
        tags = [t.strip() for t in result.split(",") if t.strip()]
        return tags[:5]

class AnthropicProvider(LLMProvider):
    def __init__(self, model: str = "claude-sonnet-4-20250514", api_key: str = None):
        from anthropic import AsyncAnthropic
        self.client = AsyncAnthropic(api_key=api_key or os.getenv("ANTHROPIC_API_KEY"))
        self.model = model

    async def generate(self, prompt: str, temperature: float = 0.7,
                       max_tokens: int = 500) -> str:
        resp = await self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=[{"role": "user", "content": prompt}]
        )
        return resp.content[0].text

    async def generate_tags(self, content: str) -> List[str]:
        # Same prompt as OpenAI
        prompt = f"""Based on the following content, generate 3-5 concise Chinese tags...
Content: {content[:2000]}"""
        result = await self.generate(prompt, temperature=0.3, max_tokens=100)
        tags = [t.strip() for t in result.split(",") if t.strip()]
        return tags[:5]

class LLMFactory:
    _providers = {
        "openai": OpenAIProvider,
        "anthropic": AnthropicProvider,
    }

    @classmethod
    def create(cls, provider: str = None, **kwargs) -> LLMProvider:
        provider = (provider or os.getenv("LLM_PROVIDER", "openai")).lower()
        model = os.getenv("LLM_MODEL", "gpt-4o-mini")
        if provider not in cls._providers:
            raise ValueError(f"Unknown LLM provider: {provider}")
        return cls._providers[provider](model=model, **kwargs)
```

### Pattern 4: BGE-M3 Model Loading and Inference
**What:** Load model at startup, encode text to embeddings.
**When to use:** Vectorizer Service lifespan startup.
**Example:**
```python
# Source: Context7 sentence-transformers docs + WebSearch verified
from sentence_transformers import SentenceTransformer
import torch
import numpy as np

class BGEM3Embedder:
    def __init__(self, model_name: str = "BAAI/bge-m3", device: str = None):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model = SentenceTransformer(model_name, device=self.device)
        print(f"BGE-M3 loaded on {self.device}")

    def encode(self, text: str) -> list:
        """Encode text to 1024-dim vector, return as list for JSON serialization."""
        embedding = self.model.encode(text, normalize_embeddings=True)
        return embedding.tolist()

    @property
    def dimension(self) -> int:
        return 1024  # BGE-M3 outputs 1024 dimensions
```

### Pattern 5: Link Scraping with Anti-Bot
**What:** httpx async client with browser headers, BeautifulSoup content extraction.
**When to use:** Processor Service link:fetch consumer.
**Example:**
```python
# Source: WebSearch anti-bot patterns + httpx docs
import httpx
from bs4 import BeautifulSoup

class LinkScraper:
    def __init__(self):
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(15.0, connect=10.0),
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                              "AppleWebKit/537.36 (KHTML, like Gecko) "
                              "Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
            }
        )

    async def scrape(self, url: str) -> dict:
        resp = await self.client.get(url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

        title = soup.title.string.strip() if soup.title else ""

        # Extract main content: prefer article, main, or largest paragraph block
        content = ""
        for selector in ["article", "main", "[role='main']", ".content", ".post"]:
            elem = soup.select_one(selector)
            if elem:
                content = elem.get_text(separator="\n", strip=True)
                break
        if not content:
            # Fallback: all paragraphs
            paragraphs = soup.find_all("p")
            content = "\n".join(p.get_text(strip=True) for p in paragraphs[:20])

        # Limit content length for LLM processing
        content = content[:8000]

        return {"title": title, "content": content, "url": str(resp.url)}

    async def close(self):
        await self.client.aclose()
```

### Pattern 6: Sub-Task State Tracking in JSONB
**What:** Track individual task status in metadata JSONB, aggregate to processing_status.
**When to use:** Memory Service internal API handler.
**Example:**
```python
# Source: CONTEXT.md D-13 + D-14 + database schema analysis
# Go implementation in Memory Service

// SubTaskState represents a single sub-task's status
type SubTaskState struct {
    Status    string `json:"status"`     // pending, processing, completed, failed
    Error     string `json:"error,omitempty"`
    UpdatedAt string `json:"updated_at"`
    RetryCount int   `json:"retry_count,omitempty"`
}

// TaskStatusUpdate is the request body for internal API
type TaskStatusUpdate struct {
    TaskType string `json:"task_type" binding:"required,oneof=link:fetch text:vectorize tag:generate"`
    Status   string `json:"status" binding:"required,oneof=pending processing completed failed"`
    Error    string `json:"error,omitempty"`
    Result   map[string]interface{} `json:"result,omitempty"` // e.g., {"tags": [...]}, {"vector": [...]}
}

// AggregateStatus computes overall status from sub-tasks
func AggregateStatus(tasks map[string]SubTaskState) string {
    hasProcessing := false
    hasFailed := false
    hasCompleted := false

    for _, task := range tasks {
        switch task.Status {
        case "processing":
            hasProcessing = true
        case "failed":
            hasFailed = true
        case "completed":
            hasCompleted = true
        }
    }

    if hasProcessing {
        return "processing"
    }
    if hasFailed && hasCompleted {
        return "partial_failed"
    }
    if hasFailed && !hasCompleted {
        return "failed"
    }
    return "completed"
}
```

### Pattern 7: Internal API Client (Python)
**What:** HTTP client for Processor/Vectorizer to call Memory Service.
**When to use:** Both Python services to report task completion/failure.
**Example:**
```python
# Source: CLAUDE.md D-12 + existing API patterns
import httpx
import os

class MemoryServiceClient:
    def __init__(self, base_url: str = None):
        self.base_url = base_url or os.getenv("MEMORY_SERVICE_URL", "http://memory-service:8002")
        self.client = httpx.AsyncClient(timeout=10.0)
        self.token = os.getenv("INTERNAL_API_TOKEN", "")

    async def update_task_status(self, memory_id: str, task_type: str,
                                  status: str, error: str = None,
                                  result: dict = None):
        payload = {
            "task_type": task_type,
            "status": status,
        }
        if error:
            payload["error"] = error
        if result:
            payload["result"] = result

        headers = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        resp = await self.client.patch(
            f"{self.base_url}/api/v1/internal/memories/{memory_id}/tasks",
            json=payload,
            headers=headers
        )
        resp.raise_for_status()
        return resp.json()

    async def close(self):
        await self.client.aclose()
```

### Anti-Patterns to Avoid
- **Direct DB access from Python services:** Violates D-12. Always use internal API.
- **ACK before processing:** Violates at-least-once semantics. ACK only after success.
- **Synchronous model loading in request handler:** Blocks event loop. Load in lifespan.
- **No retry count tracking:** Infinite retry loops. Track retry_count in message or metadata.
- **Using requests instead of httpx:** Blocks event loop. Use httpx.AsyncClient.
- **Hard-coded LLM prompts:** Violates D-03/D-05. Load from env or config file.
- **Truncating instead of LLM summarization:** Violates D-07. Use LLM for link summary.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Redis Stream consumption | Custom polling loop with BLPOP | redis-py XREADGROUP + XACK | Consumer groups provide delivery tracking, ACK, pending list, auto-claim |
| LLM HTTP client | Raw aiohttp/httpx to OpenAI/Anthropic | openai.AsyncOpenAI / anthropic.AsyncAnthropic | Official SDKs handle retries, streaming, auth, rate limits |
| HTML parsing | Regex on raw HTML | BeautifulSoup + lxml | Handles malformed HTML, encodings, nested structures |
| Sentence embeddings | Custom PyTorch model loading | sentence-transformers | Standardized interface, batching, device management, model hub |
| Background task scheduling | threading.Thread | asyncio.create_task in lifespan | Integrates with FastAPI event loop, proper cancellation |
| Config management | os.getenv scattered | pydantic-settings BaseSettings | Type validation, defaults, env file support |
| Vector normalization | Manual numpy ops | model.encode(normalize_embeddings=True) | Built-in, tested, handles edge cases |

**Key insight:** The Python ecosystem has mature, well-tested libraries for every component in this phase. The value is in wiring them together correctly, not in reimplementing them.

## Runtime State Inventory

> This phase involves new service implementations but no rename/refactor/migration of existing data. However, runtime state must be considered.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Redis Streams may have unconsumed messages from Sprint 2 | Processor/Vectorizer consumers should use `id="0"` on first startup to consume backlog, then `$` for new messages |
| Live service config | docker-compose.yml has `PROCESSOR_SERVICE_URL` and `VECTORIZER_SERVICE_URL` env vars in memory-service | These are for reference only; actual communication is Processor/Vectorizer → Memory Service, not the reverse |
| OS-registered state | None — services run in Docker containers | No action needed |
| Secrets/env vars | No LLM API keys configured yet | Add `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `LLM_PROVIDER`, `LLM_MODEL` to .env template |
| Build artifacts | None relevant | No action needed |

## Common Pitfalls

### Pitfall 1: BGE-M3 Dimension Mismatch
**What goes wrong:** Database schema defines `VECTOR(768)` but BGE-M3 outputs 1024 dimensions. Vector insertion fails with dimension mismatch.
**Why it happens:** PRD specified BGE-M3 but migration was written assuming 768-dim output (possibly from an older model spec).
**How to avoid:** Update migration to `VECTOR(1024)` OR use a 768-dim model like `BAAI/bge-small-zh-v1.5`. Given D-02 (core dependency on AI) and explicit BGE-M3 mention, update the schema.
**Warning signs:** `ERROR: dimension does not match` on vector INSERT.

### Pitfall 2: Redis Stream Message Loss on Consumer Crash
**What goes wrong:** Consumer crashes during processing, message never ACKed but also never retried because consumer name changes on restart.
**Why it happens:** Using random consumer names (e.g., hostname + UUID) means pending messages for old consumer names are orphaned.
**How to avoid:** Use stable consumer names (e.g., `processor-1`, `vectorizer-1`). On startup, read pending messages with `"0"` to recover.
**Warning signs:** Growing XPENDING count, messages stuck in pending list.

### Pitfall 3: Blocking Event Loop with Model Loading
**What goes wrong:** `SentenceTransformer()` constructor blocks the event loop for 10-30 seconds, causing health checks to fail and Kubernetes to restart the pod.
**Why it happens:** Model download/loading is CPU-intensive synchronous code.
**How to avoid:** Load model in lifespan startup (before yielding), or use `asyncio.to_thread()` for the constructor call. Ensure `/health` returns 200 even while loading.
**Warning signs:** Health check timeouts, pod restart loops.

### Pitfall 4: Memory Service Internal API Authentication Gap
**What goes wrong:** Internal API endpoint is exposed without authentication, allowing any container in the network to modify memory state.
**Why it happens:** Internal APIs are often forgotten in security design.
**How to avoid:** Add a simple shared secret (`INTERNAL_API_TOKEN` env var) checked in a Gin middleware for `/api/v1/internal/*` routes. Reject requests without valid token.
**Warning signs:** No auth on internal endpoints in code review.

### Pitfall 5: LLM API Rate Limiting / Timeout
**What goes wrong:** Tag generation fails with 429 rate limit or timeout, causing tasks to retry and amplify the problem.
**Why it happens:** No rate limiting or circuit breaker on LLM calls.
**How to avoid:** Add `max_retries=3` with exponential backoff in the LLM provider. Use `asyncio.wait_for()` with a 30-second timeout. Log failures for monitoring.
**Warning signs:** Repeated 429 errors, cascading task failures.

### Pitfall 6: Content Extraction Returns Empty or Garbage
**What goes wrong:** BeautifulSoup extracts navigation text, ads, or empty content instead of article body.
**Why it happens:** Generic `get_text()` returns all text including menus/footers.
**How to avoid:** Use semantic HTML5 selectors (`article`, `main`, `[role='main']`) first, fallback to paragraph extraction. Limit to first 8000 chars for LLM context.
**Warning signs:** Tags like "Home", "About Us", "Cookie Policy" appearing in extracted content.

## Code Examples

### Redis Consumer Group Creation (idempotent)
```python
# Source: Context7 Redis docs
async def ensure_consumer_group(redis: redis.asyncio.Redis, stream: str, group: str):
    try:
        await redis.xgroup_create(stream, group, id="0", mkstream=True)
    except redis.ResponseError as e:
        if "BUSYGROUP" not in str(e):
            raise
```

### XAUTOCLAIM for Stale Messages
```python
# Source: Context7 Redis docs + redis-py docs
async def claim_stale(redis: redis.asyncio.Redis, stream: str, group: str,
                      consumer: str, idle_ms: int = 30000, count: int = 10):
    """Claim messages idle for more than idle_ms milliseconds."""
    result = await redis.xautoclaim(
        name=stream, groupname=group, consumername=consumer,
        min_idle_time=idle_ms, start_id="0-0", count=count
    )
    # result: (next_start_id, [(msg_id, fields), ...])
    return result[1]
```

### OpenAI Async Client with Retry
```python
# Source: openai SDK docs + WebSearch patterns
from openai import AsyncOpenAI, RateLimitError
import asyncio

class OpenAIProvider:
    def __init__(self, model: str, api_key: str):
        self.client = AsyncOpenAI(api_key=api_key, max_retries=3)
        self.model = model

    async def generate(self, prompt: str, temperature: float = 0.7,
                       max_tokens: int = 500) -> str:
        for attempt in range(3):
            try:
                resp = await asyncio.wait_for(
                    self.client.chat.completions.create(
                        model=self.model,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=temperature,
                        max_tokens=max_tokens
                    ),
                    timeout=30.0
                )
                return resp.choices[0].message.content
            except RateLimitError:
                wait = 2 ** attempt
                await asyncio.sleep(wait)
            except asyncio.TimeoutError:
                if attempt == 2:
                    raise
                await asyncio.sleep(1)
```

### Memory Service Internal Handler (Go)
```go
// Source: Existing codebase patterns + D-12/D-13/D-14
func (h *MemoryHandler) RegisterRoutes(router *gin.RouterGroup) {
    // ... existing routes ...
    internal := router.Group("/internal")
    internal.Use(internalAuthMiddleware())
    internal.PATCH("/memories/:id/tasks", h.UpdateTaskStatus)
}

func (h *MemoryHandler) UpdateTaskStatus(c *gin.Context) {
    memoryID, err := uuid.Parse(c.Param("id"))
    if err != nil {
        c.JSON(400, gin.H{"error": "invalid memory ID"})
        return
    }

    var req domain.TaskStatusUpdate
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }

    memory, err := h.memoryService.GetByID(c.Request.Context(), memoryID)
    if err != nil {
        c.JSON(404, gin.H{"error": "memory not found"})
        return
    }

    // Update sub-task state in metadata JSONB
    var metadata map[string]interface{}
    if memory.Metadata != "" {
        json.Unmarshal([]byte(memory.Metadata), &metadata)
    }
    tasks, _ := metadata["tasks"].(map[string]interface{})
    if tasks == nil {
        tasks = make(map[string]interface{})
    }

    taskState := map[string]interface{}{
        "status":     req.Status,
        "updated_at": time.Now().UTC().Format(time.RFC3339),
    }
    if req.Error != "" {
        taskState["error"] = req.Error
    }
    tasks[req.TaskType] = taskState
    metadata["tasks"] = tasks

    // Recompute aggregated status
    // ... AggregateStatus logic ...

    // Save to DB
    memory.Metadata = mustMarshalJSON(metadata)
    memory.ProcessingStatus = aggregatedStatus
    h.memoryService.Update(c.Request.Context(), memory)

    c.JSON(200, gin.H{"success": true})
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Redis Pub/Sub | Redis Streams with Consumer Groups | Redis 5.0+ (2018) | Reliable delivery, pending tracking, consumer failover |
| `@app.on_event` | `@asynccontextmanager` lifespan | FastAPI 0.93+ (2023) | Unified startup/shutdown, better testability |
| openai<1.0 synchronous | openai>=1.0 async client | 2023 | Native async, better performance, modern API |
| requests (sync HTTP) | httpx (async HTTP) | 2020+ | Non-blocking I/O, HTTP/2, compatible API |
| BGE-M3 768-dim assumption | BGE-M3 1024-dim reality | Always | Schema must match model output |

**Deprecated/outdated:**
- `openai` < 1.0: Complete API rewrite, old patterns don't work [VERIFIED: pip registry]
- `@app.on_event("startup")`: Replaced by lifespan in FastAPI [VERIFIED: Context7 FastAPI docs]
- Manual Redis BLPOP polling: Streams with Consumer Groups supersede this pattern [VERIFIED: Context7 Redis docs]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | BGE-M3 outputs 1024 dimensions | Standard Stack / Pitfall 1 | If actually 768, schema update is unnecessary; if some variant outputs 768, model loading will fail |
| A2 | Redis 7 in docker-compose supports XAUTOCLAIM | Standard Stack | XAUTOCLAIM requires Redis 6.2+; Redis 7 is used, so this is safe |
| A3 | `openai>=1.0` and `anthropic>=0.30` have stable async APIs | Standard Stack / Code Examples | API changes in newer versions may require code adjustments |
| A4 | Memory Service can safely expose internal API at `/api/v1/internal/*` | Pattern 6 / Pitfall 4 | If Gateway routes all `/api/v1/*` traffic, internal routes may be exposed externally; need Gateway exclusion or separate port |
| A5 | PostgreSQL JSONB can store nested sub-task state without schema migration | Pattern 6 | JSONB supports arbitrary nesting; existing `{}` default is compatible |

## Open Questions

1. **BGE-M3 dimension mismatch resolution**
   - What we know: BGE-M3 outputs 1024 dimensions, schema has `VECTOR(768)`
   - What's unclear: Whether to update schema to 1024 or use a different 768-dim model
   - Recommendation: Update schema to `VECTOR(1024)` to match BGE-M3. This requires a migration file update (or new migration) and reindexing.

2. **Internal API authentication mechanism**
   - What we know: D-12 requires Processor/Vectorizer to call Memory Service
   - What's unclear: How to authenticate internal service-to-service calls
   - Recommendation: Simple shared secret via `INTERNAL_API_TOKEN` env var, validated in Gin middleware. Gateway should NOT route `/internal` paths externally.

3. **Link content for vectorization**
   - What we know: R2.6 says link types also need vectorization
   - What's unclear: Whether to vectorize the raw URL, the scraped title, or the scraped content
   - Recommendation: After link scraping completes, publish a derived `text:vectorize` task with the scraped content (title + summary). This means Processor may also act as a producer.

4. **Vector storage API design**
   - What we know: Vector is stored in PostgreSQL, but Processor/Vectorizer don't access DB directly
   - What's unclear: Whether the internal API should accept raw vector arrays or the Vectorizer should call a dedicated vector storage endpoint
   - Recommendation: Internal API accepts `result: { "vector": [0.1, 0.2, ...] }` and Memory Service handles the SQL UPDATE with proper pgvector syntax.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11 | Processor/Vectorizer services | Yes (Docker base image) | 3.11-slim | — |
| Redis 7 | Consumer Groups, XAUTOCLAIM | Yes (docker-compose) | 7-alpine | — |
| PostgreSQL 15 + pgvector | Vector storage | Yes (docker-compose) | pg15 | — |
| CUDA/GPU | BGE-M3 inference acceleration | No (CPU only in dev) | — | CPU inference (slower but functional) |
| OpenAI API key | LLM tag generation | No (not configured) | — | Anthropic API key (if configured) |
| Anthropic API key | LLM tag generation | No (not configured) | — | OpenAI API key (if configured) |

**Missing dependencies with no fallback:**
- LLM API key: At least one of `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` must be set for tag generation to work. Without it, tag generation tasks will fail after 3 retries.

**Missing dependencies with fallback:**
- GPU: BGE-M3 runs fine on CPU for development. For production, consider adding GPU support to docker-compose or K8s.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (Python services), Go test (Memory Service) |
| Config file | None — see Wave 0 |
| Quick run command | `pytest tests/ -x -q` (Python), `go test ./...` (Go) |
| Full suite command | `pytest tests/` (Python), `go test ./... -v` (Go) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R5.1 | LLM Provider unified interface | unit | `pytest tests/test_llm_provider.py -x` | No — Wave 0 |
| R5.2 | OpenAI/Anthropic switch | unit | `pytest tests/test_llm_factory.py -x` | No — Wave 0 |
| R5.3 | Factory pattern creation | unit | `pytest tests/test_llm_factory.py -x` | No — Wave 0 |
| R5.4 | Redis Stream task publishing | integration | `go test ./... -run TestPublishTasks` | No — Wave 0 |
| R5.5 | Task types correct | unit | `pytest tests/test_consumers.py -x` | No — Wave 0 |
| R5.6 | Status flow correct | integration | `go test ./... -run TestStatusFlow` | No — Wave 0 |
| R5.7 | Retry max 3 times | unit | `pytest tests/test_consumer_retry.py -x` | No — Wave 0 |
| R2.5 | Link scraping extracts content | integration | `pytest tests/test_scraper.py -x` | No — Wave 0 |
| R2.6 | Link type vectorized | integration | `pytest tests/test_vectorize_link.py -x` | No — Wave 0 |
| R2.7 | LLM generates Chinese tags | integration | `pytest tests/test_tag_generation.py -x` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest tests/test_{module}.py -x -q`
- **Per wave merge:** `pytest tests/` (Python), `go test ./...` (Go)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `services/processor-service/tests/` — test directory missing
- [ ] `services/vectorizer-service/tests/` — test directory missing
- [ ] `services/processor-service/tests/test_llm_provider.py` — covers R5.1, R5.2, R5.3
- [ ] `services/processor-service/tests/test_consumers.py` — covers R5.5, R5.7
- [ ] `services/processor-service/tests/test_scraper.py` — covers R2.5
- [ ] `services/vectorizer-service/tests/test_embedder.py` — covers BGE-M3 integration
- [ ] `services/memory-service/tests/test_internal_api.go` — covers R5.6, D-12, D-14
- [ ] pytest install: `pip install pytest pytest-asyncio` — if not detected

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Internal API token (`INTERNAL_API_TOKEN`) for service-to-service auth |
| V3 Session Management | No | No user sessions in Python services |
| V4 Access Control | Yes | Gateway must NOT route `/internal` paths externally |
| V5 Input Validation | Yes | Pydantic models for all API inputs; URL validation for link scraping |
| V6 Cryptography | No | No custom crypto; rely on HTTPS/TLS for service communication |
| V7 Error Handling | Yes | Accurate errors (D-01), no sensitive data in error messages |
| V10 Logging | Yes | Structured logging with trace_id; log LLM call metrics |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Internal API exposed externally | Information Disclosure | Gateway exclude `/internal/*`; separate port or network segment |
| LLM API key leakage | Information Disclosure | Env vars only, never commit; SOPS for production |
| SSRF via link scraping | Spoofing | URL scheme whitelist (http/https only); deny private IP ranges |
| Prompt injection via user content | Tampering | No user content directly in system prompts; sanitize before LLM call |
| Redis Stream poisoning | Tampering | No auth on Redis in dev; add Redis AUTH in production |
| Infinite retry amplification | Denial of Service | Max 3 retries (D-16), exponential backoff, circuit breaker |

## Sources

### Primary (HIGH confidence)
- Context7 `/redis/docs` — XREADGROUP, XACK, XGROUP CREATE, XAUTOCLAIM, XPENDING command documentation
- Context7 `/fastapi/fastapi` — Lifespan events, background tasks, startup/shutdown patterns
- Context7 `/huggingface/sentence-transformers` — Model loading, encode API, device configuration, batch processing
- pip registry — Package versions verified: openai 2.32.0, anthropic 0.96.0, sentence-transformers 5.4.1, redis 7.4.0, httpx 0.28.1, beautifulsoup4 4.14.3, lxml 6.1.0

### Secondary (MEDIUM confidence)
- WebSearch: "BGE-M3 sentence-transformers inference 2025" — Model architecture, 1024-dim output, device options
- WebSearch: "OpenAI Anthropic Python SDK factory pattern abstraction 2025" — Factory pattern design, async client usage
- WebSearch: "httpx beautifulsoup link scraping anti-bot user-agent 2025" — Anti-bot headers, content extraction patterns
- WebSearch: "redis-py XREADGROUP XACK consumer group Python example 2025" — Python implementation patterns
- WebSearch: "FastAPI lifespan asyncio background consumer redis stream graceful shutdown 2025" — Lifespan + consumer integration

### Tertiary (LOW confidence)
- WebSearch: "BGE-M3 Matryoshka representation learning dimension truncation 2025" — Confirmed BGE-M3 does NOT support MRL, output is fixed 1024-dim
- GitHub issue agentscope-ai/ReMe#69 — Direct confirmation that BGE-M3 does not support matryoshka representation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All versions verified via pip registry, libraries are stable and well-documented
- Architecture: HIGH — Patterns verified via Context7 docs and multiple WebSearch sources
- Pitfalls: HIGH — Dimension mismatch is verifiable fact; other pitfalls are standard distributed systems patterns
- Redis Consumer Groups: HIGH — Context7 Redis docs are authoritative
- BGE-M3 specifics: MEDIUM-HIGH — Could not run live model test (Python execution blocked), but multiple sources confirm 1024-dim output

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (30 days for stable stack)
