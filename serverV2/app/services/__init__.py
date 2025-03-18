"""Services package for the Recall API."""

# Buffer service
from app.services.buffer_service import (
    create_buffer,
    update_buffer,
    mark_buffer_outdated,
    soft_delete_buffer,
    get_buffer_by_id,
)

# Search service
from app.services.search_service import search_buffers, search_chunks

# Embedding service
from app.services.embedding_service import (
    generate_embedding,
    calculate_similarity,
    EmbeddingProvider,
)

# Chunking service
from app.services.chunking_service import chunk_text, extract_title_from_text

# LLM service
from app.services.llm_service import generate_llm_response

# Template service
from app.services.template_service import format_augmented_response, get_template, render_template

# Augmentation service
from app.services.augmentation_service import generate_augmented_response
