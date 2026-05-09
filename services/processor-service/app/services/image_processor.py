"""Image generation, processing, and upload for memory covers."""

import base64
import hashlib
import io
import logging
import os
from typing import Optional

import httpx
from PIL import Image, ImageDraw, ImageFont, ImageOps
from minio import Minio

logger = logging.getLogger(__name__)

# Prompt template for cover generation
COVER_PROMPT_TEMPLATE = (
    "A beautiful, minimal illustration representing: {title}. {summary}. "
    "Style: soft watercolor, gentle colors, clean composition, no text, no words, no letters."
)


def _build_prompt(title: str, summary: str) -> str:
    """Build English prompt for image generation from title and summary."""
    safe_title = (title or "").strip()[:100]
    safe_summary = (summary or "").strip()[:200]
    return COVER_PROMPT_TEMPLATE.format(title=safe_title, summary=safe_summary)


def _extract_title_and_summary(content: str, content_type: str, link_title: str = "", link_url: str = "") -> tuple:
    """Extract title and summary from memory content based on type."""
    if content_type == "link":
        title = link_title or ""
        summary = content or ""  # scraped content
        if not title and link_url:
            # Use domain as title fallback
            from urllib.parse import urlparse
            parsed = urlparse(link_url)
            title = parsed.netloc or "Link"
        return title, summary[:200]

    if content_type == "file":
        # Extract first paragraph as title, rest as summary
        lines = [l.strip() for l in (content or "").split("\n") if l.strip()]
        if lines:
            title = lines[0][:50]
            summary = " ".join(lines[1:5])[:200]
            return title, summary
        return "Document", ""

    # text type (default)
    lines = [l.strip() for l in (content or "").split("\n") if l.strip()]
    if lines:
        title = lines[0][:50]
        # First 200 chars of content as summary
        summary = content[:200]
        return title, summary
    return "Memory", ""


async def generate_cover_image(prompt: str, api_key: str = None) -> Image.Image:
    """Generate image using DALL-E 3. Returns PIL Image.

    Args:
        prompt: English prompt for image generation.
        api_key: OpenAI API key. If None, uses OPENAI_API_KEY env var.

    Returns:
        PIL Image object (1024x1024 PNG from DALL-E 3).

    Raises:
        RuntimeError: If DALL-E 3 generation fails.
    """
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key or os.getenv("OPENAI_API_KEY"))
    resp = await client.images.generate(
        model="dall-e-3",
        prompt=prompt,
        size="1024x1024",
        quality="standard",
        response_format="b64_json",
        n=1,
    )
    b64_data = resp.data[0].b64_json
    image_bytes = base64.b64decode(b64_data)
    return Image.open(io.BytesIO(image_bytes))


async def generate_cover_pollinations(prompt: str) -> Image.Image:
    """Generate image using Pollinations.AI as fallback.

    Args:
        prompt: English prompt for image generation.

    Returns:
        PIL Image object.

    Raises:
        RuntimeError: If Pollinations.AI generation fails.
    """
    # URL-encode prompt for query parameter
    import urllib.parse
    encoded_prompt = urllib.parse.quote(prompt)
    url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true&seed=42&enhance=true"

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return Image.open(io.BytesIO(resp.content))


def crop_cover(image: Image.Image, target_size: tuple = (400, 300)) -> bytes:
    """Crop and resize image to target size using center crop.

    Args:
        image: PIL Image object.
        target_size: Target dimensions (width, height). Default (400, 300).

    Returns:
        JPEG-encoded bytes with quality=90.
    """
    fitted = ImageOps.fit(
        image,
        target_size,
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    )
    # Convert to RGB if necessary (handles RGBA/PNG from DALL-E)
    if fitted.mode in ("RGBA", "P"):
        fitted = fitted.convert("RGB")
    buf = io.BytesIO()
    fitted.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def create_fallback_cover(tag: str, size: tuple = (400, 300)) -> bytes:
    """Create a fallback cover with solid color background + first letter.

    Color is derived from the first tag's MD5 hash (HSL hue), matching
    the frontend tag hash color algorithm for visual consistency.

    Args:
        tag: First tag string (used for color and letter).
        size: Target dimensions (width, height). Default (400, 300).

    Returns:
        PNG-encoded bytes.
    """
    h = hashlib.md5((tag or "?").encode("utf-8")).hexdigest()
    # Use first 4 hex chars for hue (0-360)
    hue = int(h[:4], 16) % 360
    # Convert HSL to RGB: saturation=65%, lightness=55% for pleasant colors
    import colorsys
    r, g, b = colorsys.hls_to_rgb(hue / 360.0, 0.55, 0.65)
    color = (int(r * 255), int(g * 255), int(b * 255))

    img = Image.new("RGB", size, color)
    draw = ImageDraw.Draw(img)
    letter = (tag or "?")[0].upper()

    # Try to load a font, fallback to default
    font_size = min(size[0], size[1]) // 2
    try:
        font = ImageFont.truetype("arial.ttf", font_size)
    except Exception:
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except Exception:
            font = ImageFont.load_default()

    # Calculate text position for centering
    bbox = draw.textbbox((0, 0), letter, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (size[0] - text_w) // 2
    y = (size[1] - text_h) // 2

    draw.text((x, y), letter, fill="white", font=font)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def upload_cover_to_minio(minio_client: Minio, user_id: str, memory_id: str, image_data: bytes) -> str:
    """Upload cover image to MinIO and return public URL.

    Args:
        minio_client: Configured MinIO client.
        user_id: User UUID string.
        memory_id: Memory UUID string.
        image_data: JPEG/PNG bytes.

    Returns:
        Public URL of the uploaded cover image.
    """
    object_name = f"covers/{user_id}/{memory_id}.jpg"
    bucket = "echoes-files"
    stream = io.BytesIO(image_data)

    minio_client.put_object(
        bucket,
        object_name,
        stream,
        len(image_data),
        content_type="image/jpeg",
    )

    # Build public URL
    endpoint = minio_client._endpoint_url.netloc
    return f"http://{endpoint}/{bucket}/{object_name}"


def get_minio_client() -> Minio:
    """Create MinIO client from environment variables."""
    endpoint = os.getenv("MINIO_ENDPOINT", "echoes-minio:9000")
    access_key = os.getenv("MINIO_ACCESS_KEY", "echoes_minio")
    secret_key = os.getenv("MINIO_SECRET_KEY", "echoes_minio_secret")
    secure = os.getenv("MINIO_SECURE", "false").lower() == "true"
    return Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=secure)


async def fetch_og_image(link_url: str) -> Optional[bytes]:
    """Fetch og:image from a link URL.

    Args:
        link_url: The URL to scrape.

    Returns:
        Image bytes if og:image found and downloadable, None otherwise.
    """
    from bs4 import BeautifulSoup
    from urllib.parse import urljoin

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=5.0),
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                              "AppleWebKit/537.36 (KHTML, like Gecko) "
                              "Chrome/120.0.0.0 Safari/537.36",
            },
        ) as client:
            resp = await client.get(link_url)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")
            og = soup.find("meta", property="og:image")
            if not og:
                return None
            img_url = og.get("content", "")
            if not img_url:
                return None
            # Resolve relative URLs
            if not img_url.startswith("http"):
                img_url = urljoin(str(resp.url), img_url)
            # Download the image
            img_resp = await client.get(img_url)
            img_resp.raise_for_status()
            return img_resp.content
    except Exception as e:
        logger.warning(f"Failed to fetch og:image from {link_url}: {e}")
        return None
