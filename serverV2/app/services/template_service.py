"""
Template service for formatting responses.

This module handles the rendering of templates for augmented responses,
allowing customization of the response format.
"""

from typing import Dict, Any, List, Optional
from jinja2 import Template, Environment, meta
import re
from datetime import datetime

from app.db import get_supabase_client
from app.logging_config import get_logger

logger = get_logger(__name__)


def extract_key_points(text: str, max_points: int = 5) -> List[str]:
    """
    Extract key points from response text.

    Args:
        text: Response text to extract points from
        max_points: Maximum number of points to extract

    Returns:
        List[str]: Extracted key points
    """
    # Look for bullet points
    bullet_points = re.findall(r"[•\-\*]\s+(.*?)(?=\n[•\-\*]|\n\n|$)", text, re.DOTALL)

    if bullet_points and len(bullet_points) >= 3:
        return [point.strip() for point in bullet_points[:max_points]]

    # Look for numbered points
    numbered_points = re.findall(r"\d+\.\s+(.*?)(?=\n\d+\.|\n\n|$)", text, re.DOTALL)

    if numbered_points and len(numbered_points) >= 3:
        return [point.strip() for point in numbered_points[:max_points]]

    # Extract sentences as fallback
    sentences = re.split(r"(?<=[.!?])\s+", text)
    important_sentences = []

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        # Look for important indicators
        if re.search(
            r"\b(key|important|crucial|significant|main|primary|essential)\b",
            sentence,
            re.IGNORECASE,
        ):
            important_sentences.append(sentence)

        # If we have enough, stop
        if len(important_sentences) >= max_points:
            break

    # If we found important sentences, use those
    if important_sentences:
        return important_sentences[:max_points]

    # Otherwise, just use the first few sentences
    return [s.strip() for s in sentences[:max_points] if s.strip()]


def format_datetime(dt_str: str, format_str: str = "%B %d, %Y") -> str:
    """
    Format a datetime string.

    Args:
        dt_str: Datetime string to format
        format_str: Format string for the output

    Returns:
        str: Formatted datetime string
    """
    try:
        if isinstance(dt_str, str):
            dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
            return dt.strftime(format_str)
    except:
        pass

    return dt_str


async def get_template(template_name: str, user_id: Optional[str] = None) -> Optional[str]:
    """
    Get a template by name, with optional user-specific templates.

    Args:
        template_name: Name of the template to retrieve
        user_id: Optional user ID for user-specific templates

    Returns:
        Optional[str]: Template string if found, None otherwise
    """
    supabase = get_supabase_client()

    # Try to get a user-specific template first
    if user_id:
        user_template = (
            supabase.table("response_templates")
            .select("template")
            .eq("name", template_name)
            .eq("user_id", user_id)
            .execute()
        )

        if user_template.data:
            return user_template.data[0]["template"]

    # Fall back to default templates
    default_template = (
        supabase.table("response_templates")
        .select("template")
        .eq("name", template_name)
        .is_("user_id", "null")
        .execute()
    )

    if default_template.data:
        return default_template.data[0]["template"]

    # Fall back to hard-coded defaults if nothing in the database
    default_templates = {
        "default": """
Based on the information in your notes, here is what I found about "{{query}}":

{{response}}

{% if sources and sources|length > 0 %}
Sources:
{% for source in sources %}
- {% if source.title %}{{source.title}}{% else %}Note from{% endif %} {{source.created_at|format_datetime}}
{% endfor %}
{% endif %}
""",
        "summary": """
# Summary of "{{query}}"

{{response}}

{% if key_points and key_points|length > 0 %}
## Key Points
{% for point in key_points %}
- {{point}}
{% endfor %}
{% endif %}
""",
        "concise": "{{response}}",
    }

    return default_templates.get(template_name, default_templates["default"])


def render_template(template_str: str, context: Dict[str, Any]) -> str:
    """
    Render a template with the given context.

    Args:
        template_str: Template string to render
        context: Context variables for the template

    Returns:
        str: Rendered template
    """
    # Create Jinja2 environment with custom filters
    env = Environment()
    env.filters["format_datetime"] = format_datetime

    # Create template
    template = env.from_string(template_str)

    # Extract key points if needed
    variables = meta.find_undeclared_variables(env.parse(template_str))
    if "key_points" in variables and "key_points" not in context and "response" in context:
        context["key_points"] = extract_key_points(context["response"])

    # Render template
    try:
        result = template.render(**context)
        return result
    except Exception as e:
        logger.error(f"Error rendering template: {str(e)}")
        # Fall back to just returning the response
        return context.get("response", "")


async def format_augmented_response(
    query: str,
    response: str,
    sources: List[Dict[str, Any]],
    template_name: str = "default",
    user_id: Optional[str] = None,
) -> str:
    """
    Format an augmented response using a template.

    Args:
        query: Original search query
        response: Generated response text
        sources: Source information
        template_name: Name of the template to use
        user_id: Optional user ID for user-specific templates

    Returns:
        str: Formatted response
    """
    # Get the template
    template_str = await get_template(template_name, user_id)

    if not template_str:
        logger.warning(f"Template '{template_name}' not found, using response as is")
        return response

    # Prepare context
    context = {
        "query": query,
        "response": response,
        "sources": sources,
    }

    # Render the template
    formatted_response = render_template(template_str, context)

    return formatted_response
