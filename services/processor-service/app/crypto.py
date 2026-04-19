"""AES-256-GCM encryption/decryption compatible with Go implementation."""

import base64
import hashlib
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _get_key() -> bytes:
    """Derive 32-byte encryption key from ENCRYPTION_KEY or JWT_SECRET."""
    key = os.getenv("ENCRYPTION_KEY") or os.getenv("JWT_SECRET") or ""
    if not key:
        # Fallback for development only
        key = "echoes-dev-encryption-key-change-in-production"
    return hashlib.sha256(key.encode("utf-8")).digest()


_ENCRYPTION_KEY = _get_key()


def decrypt(ciphertext_b64: str) -> str:
    """Decrypt a base64-encoded AES-256-GCM ciphertext."""
    if not ciphertext_b64:
        return ""
    data = base64.b64decode(ciphertext_b64)
    aesgcm = AESGCM(_ENCRYPTION_KEY)
    # Go implementation prepends nonce to ciphertext
    nonce = data[:12]
    ciphertext = data[12:]
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    return plaintext.decode("utf-8")
