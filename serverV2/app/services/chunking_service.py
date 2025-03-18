"""
Chunking service for splitting text into semantic chunks.

This module handles the splitting of buffer content into smaller,
semantically meaningful chunks for more precise retrieval.
"""

import re
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime

from app.config import get_settings
from app.logging_config import get_logger

logger = get_logger(__name__)
settings = get_settings()


def extract_title_from_text(text: str, max_length: int = 60) -> str:
    """
    Extract a title from the beginning of the text.

    Args:
        text: Text to extract title from
        max_length: Maximum length of the title

    Returns:
        str: Extracted title
    """
    # Try to find a heading (# Title, ## Title, etc.)
    heading_match = re.search(r"^(#+)\s+(.+)$", text, re.MULTILINE)
    if heading_match:
        title = heading_match.group(2).strip()
        return title[:max_length] if len(title) > max_length else title

    # Try to find the first sentence
    sentence_match = re.search(r"^([^.!?]+[.!?])(?:\s|$)", text.strip())
    if sentence_match:
        title = sentence_match.group(1).strip()
        return title[:max_length] if len(title) > max_length else title

    # Use the first line if it's not too long
    first_line = text.strip().split("\n")[0].strip()
    if first_line and len(first_line) <= max_length:
        return first_line

    # Just use the beginning of the text
    if len(text.strip()) <= max_length:
        return text.strip()

    return text.strip()[:max_length] + "..."


def chunk_text_by_paragraph(text: str, max_chunk_size: int = 1000, overlap: int = 100) -> List[str]:
    """
    Split text into chunks by paragraph with overlap.

    Args:
        text: Text to split into chunks
        max_chunk_size: Maximum size of each chunk in characters
        overlap: Number of characters to overlap between chunks

    Returns:
        List[str]: List of text chunks
    """
    # Split text into paragraphs
    paragraphs = re.split(r"\n\s*\n", text.strip())

    chunks = []
    current_chunk = ""

    for paragraph in paragraphs:
        paragraph = paragraph.strip()
        if not paragraph:
            continue

        # If adding this paragraph would exceed max size, store chunk and start new one
        if len(current_chunk) + len(paragraph) > max_chunk_size and current_chunk:
            chunks.append(current_chunk.strip())

            # Take the last bit of the previous chunk for context overlap
            if overlap > 0 and len(current_chunk) > overlap:
                current_chunk = current_chunk[-overlap:] + "\n\n" + paragraph
            else:
                current_chunk = paragraph
        else:
            if current_chunk:
                current_chunk += "\n\n" + paragraph
            else:
                current_chunk = paragraph

    # Add the last chunk if not empty
    if current_chunk:
        chunks.append(current_chunk.strip())

    return chunks


def chunk_text_by_fixed_size(text: str, chunk_size: int = 1000, overlap: int = 100) -> List[str]:
    """
    Split text into chunks of fixed size with overlap.

    Args:
        text: Text to split into chunks
        chunk_size: Size of each chunk in characters
        overlap: Number of characters to overlap between chunks

    Returns:
        List[str]: List of text chunks
    """
    text = text.strip()
    chunks = []

    if len(text) <= chunk_size:
        chunks.append(text)
        return chunks

    start = 0
    while start < len(text):
        # Find the end of this chunk
        end = start + chunk_size

        # If we're not at the end of the text, try to end on a sentence or paragraph
        if end < len(text):
            # Look for a paragraph break
            next_para = text.find("\n\n", end - 100, end + 100)
            if next_para != -1 and next_para < end + 100:
                end = next_para
            else:
                # Look for the end of a sentence
                next_sentence = text.find(". ", end - 100, end + 100)
                if next_sentence != -1 and next_sentence < end + 100:
                    end = next_sentence + 1

        # Add the chunk
        chunks.append(text[start:end].strip())

        # Move the start position, considering overlap
        start = end - overlap if end < len(text) else len(text)

    return chunks


def determine_chunking_method(text: str) -> str:
    """
    Determine the best chunking method based on text structure.

    Args:
        text: Text to analyze

    Returns:
        str: Chunking method to use ('paragraph' or 'fixed_size')
    """
    # Count paragraphs
    paragraphs = re.split(r"\n\s*\n", text.strip())
    paragraph_count = len([p for p in paragraphs if p.strip()])

    # If there are multiple paragraphs, use paragraph chunking
    if paragraph_count > 3:
        return "paragraph"

    # Otherwise use fixed size
    return "fixed_size"


def chunk_text(
    text: str,
    chunk_size: Optional[int] = None,
    chunk_overlap: Optional[int] = None,
    method: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Split text into chunks using the appropriate method.

    Args:
        text: Text to split into chunks
        chunk_size: Maximum size of each chunk in characters
        chunk_overlap: Number of characters to overlap between chunks
        method: Chunking method to use ('paragraph', 'fixed_size', or None for auto-detect)

    Returns:
        List[Dict[str, Any]]: List of chunk objects with metadata
    """
    # Use default values if not provided
    if chunk_size is None:
        chunk_size = settings.CHUNKING.DEFAULT_CHUNK_SIZE

    if chunk_overlap is None:
        chunk_overlap = settings.CHUNKING.DEFAULT_CHUNK_OVERLAP

    # Ensure chunk_size is within allowed range
    chunk_size = max(
        settings.CHUNKING.MIN_CHUNK_SIZE, min(chunk_size, settings.CHUNKING.MAX_CHUNK_SIZE)
    )

    # Determine the method if not specified
    if method is None:
        method = determine_chunking_method(text)

    # Extract a title from the text
    title = extract_title_from_text(text)

    # Split the text into chunks
    if method == "paragraph":
        logger.debug(
            f"Using paragraph-based chunking with size={chunk_size}, overlap={chunk_overlap}"
        )
        raw_chunks = chunk_text_by_paragraph(text, chunk_size, chunk_overlap)
    else:
        logger.debug(f"Using fixed-size chunking with size={chunk_size}, overlap={chunk_overlap}")
        raw_chunks = chunk_text_by_fixed_size(text, chunk_size, chunk_overlap)

    # Create chunk objects with metadata
    chunks = []
    for i, content in enumerate(raw_chunks):
        chunk_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()

        # Basic metadata
        metadata = {
            "index": i,
            "title": title,
            "char_count": len(content),
            "word_count": len(content.split()),
        }

        # Add positional indicators
        if i == 0:
            metadata["position"] = "start"
        elif i == len(raw_chunks) - 1:
            metadata["position"] = "end"
        else:
            metadata["position"] = "middle"

        chunks.append(
            {
                "id": chunk_id,
                "content": content,
                "chunk_index": i,
                "metadata": metadata,
                "created_at": now,
            }
        )

    logger.info(f"Split text into {len(chunks)} chunks using {method} method")
    return chunks
