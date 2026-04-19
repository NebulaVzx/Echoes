import httpx
from bs4 import BeautifulSoup
from urllib.parse import urlparse


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
            },
        )

    def _validate_url(self, url: str) -> None:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            raise ValueError(f"URL scheme must be http or https, got: {parsed.scheme}")
        # Deny private IP ranges (basic SSRF protection)
        host = parsed.hostname or ""
        if host.startswith(("10.", "172.16.", "172.17.", "172.18.", "172.19.",
                            "172.20.", "172.21.", "172.22.", "172.23.", "172.24.",
                            "172.25.", "172.26.", "172.27.", "172.28.", "172.29.",
                            "172.30.", "172.31.", "192.168.", "127.", "0.0.0.0", "::1")):
            raise ValueError(f"Private IP addresses are not allowed: {host}")

    async def scrape(self, url: str) -> dict:
        self._validate_url(url)
        resp = await self.client.get(url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

        title = ""
        if soup.title and soup.title.string:
            title = soup.title.string.strip()

        # Extract main content using semantic selectors
        content = ""
        for selector in ["article", "main", "[role='main']", ".content", ".post", ".entry"]:
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
