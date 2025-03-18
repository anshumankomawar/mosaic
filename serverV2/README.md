# Recall API

A buffer-based note-taking API with AI-powered search and augmentation capabilities.

## Overview

Recall is a modern note-taking system that allows users to write content in ephemeral buffers, which are automatically stored, chunked, and indexed for retrieval. Instead of organizing notes manually, Recall uses AI to search and synthesize information from your previously written content.

Key features:
- **Ephemeral Buffers**: Write and forget - content is automatically stored and indexed
- **Semantic Search**: Find relevant content using natural language
- **AI Augmentation**: Get comprehensive answers generated from your stored content
- **Multiple LLM Support**: Use different LLM providers for response generation
- **Customizable Templates**: Format responses according to your preferences

## Architecture

- **FastAPI Backend**: Python-based API with async support
- **Supabase Database**: PostgreSQL with pgvector for vector search
- **Text Chunking**: Semantic chunking for improved retrieval precision
- **Vector Embeddings**: Convert text to embeddings for similarity search
- **Multiple LLM Providers**: Support for OpenAI, Anthropic, Cohere, and Mistral

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Supabase account
- At least one LLM API key (OpenAI, Anthropic, etc.)

### Setup

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/recall-api.git
   cd recall-api
   ```

2. Create a `.env` file based on the example:
   ```
   cp .env.example .env
   ```

3. Fill in your API keys and Supabase credentials in the `.env` file.

4. Start the services:
   ```
   docker-compose up -d
   ```

5. Initialize the database:
   ```
   # Run the SQL setup script in your Supabase project
   # Copy the contents of migrations/001_initial_setup.sql
   ```

6. Access the API documentation at `http://localhost:8000/docs`

## API Endpoints

### Buffers

- `POST /api/buffers/`: Create a new buffer
- `POST /api/buffers/update`: Update a buffer
- `POST /api/buffers/{buffer_id}/mark-outdated`: Mark a buffer as outdated
- `DELETE /api/buffers/{buffer_id}`: Soft delete a buffer
- `GET /api/buffers/{buffer_id}`: Get a buffer by ID

### Search

- `POST /api/search/`: Search for buffers and chunks

### Augmented Search

- `POST /api/augmented-search/`: Search and generate an augmented response

## Content Lifecycle

The typical lifecycle of content in Recall:

1. **Creation**: User writes content in a buffer
2. **Processing**:
   - Content is stored in the database
   - Text is split into semantic chunks
   - Chunks are embedded and indexed
3. **Retrieval**:
   - User searches for information
   - System finds relevant chunks
   - LLM generates a response based on chunks
4. **Updates**:
   - Content can be marked as outdated
   - New versions can be created
   - Search prioritizes newer content

## Development

### Project Structure

```
app/
├── api/              # API routes
├── models/           # Pydantic models
├── services/         # Business logic
├── db/               # Database access
├── utils/            # Utility functions
├── config.py         # Configuration
├── logging_config.py # Logging setup
└── main.py           # Application entry point
```

### Adding a New LLM Provider

1. Add the provider to `app/models/search.py` in the `LLMProvider` enum
2. Add configuration in `app/config.py`
3. Implement the provider in `app/services/llm_service.py`

### Custom Response Templates

Templates use Jinja2 syntax and can be added to the database:

```sql
INSERT INTO response_templates (id, user_id, name, template, description, is_default, created_at)
VALUES (
    gen_random_uuid(),
    NULL,  -- NULL for global templates, user_id for user-specific ones
    'custom_template',
    'Custom template content with {{variables}}',
    'Description of the template',
    FALSE,
    NOW()
);
```

## Environment Variables

See `.env.example` for all available configuration options.

## License

[MIT License](LICENSE)
