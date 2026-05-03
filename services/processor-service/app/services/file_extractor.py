"""Extract text content from uploaded files (.txt, .md, .docx)."""

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


def extract_text(file_path: str, file_type: str) -> str:
    """Extract plain text from a file based on its type.

    Args:
        file_path: Path to the file on local filesystem.
        file_type: File extension including dot, e.g. '.txt', '.md', '.docx'.

    Returns:
        Extracted text content.

    Raises:
        ValueError: If file type is not supported.
        IOError: If reading the file fails.
    """
    file_type = file_type.lower()

    if file_type in (".txt", ".md"):
        return _extract_text_file(file_path)
    elif file_type == ".docx":
        return _extract_docx(file_path)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


def _extract_text_file(file_path: str) -> str:
    """Read a text or markdown file as UTF-8."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    except UnicodeDecodeError:
        # Fallback to latin-1 if UTF-8 fails
        with open(file_path, "r", encoding="latin-1") as f:
            return f.read()


def _extract_docx(file_path: str) -> str:
    """Extract text from a .docx file using python-docx."""
    try:
        from docx import Document

        doc = Document(file_path)
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n\n".join(paragraphs)
    except ImportError:
        logger.error("python-docx not installed, cannot extract .docx")
        raise RuntimeError("python-docx library is not installed")
    except Exception as e:
        logger.error(f"Failed to extract docx: {e}")
        raise IOError(f"Failed to extract docx: {e}")
