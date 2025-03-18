"""
Logging configuration for the Recall API.

This module sets up structured logging for the application.
"""

import logging
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional
import os

# Default log level
DEFAULT_LOG_LEVEL = "INFO"


class JsonFormatter(logging.Formatter):
    """
    Custom JSON formatter for structured logging.
    """

    def format(self, record: logging.LogRecord) -> str:
        """
        Format the log record as a JSON string.

        Args:
            record: Log record to format

        Returns:
            str: JSON-formatted log entry
        """
        log_record: Dict[str, Any] = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add request_id if available
        if hasattr(record, "request_id"):
            log_record["request_id"] = record.request_id

        # Add extra fields from record
        if hasattr(record, "extra") and isinstance(record.extra, dict):
            for key, value in record.extra.items():
                if key not in log_record:
                    log_record[key] = value

        # Add exception info if available
        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_record)


def setup_logging() -> None:
    """
    Configure application logging.

    Sets up console handler with appropriate formatter and log level.
    """
    # Get log level from environment
    log_level_name = os.environ.get("LOG_LEVEL", DEFAULT_LOG_LEVEL).upper()
    log_level = getattr(logging, log_level_name, logging.INFO)

    # Get root logger
    root_logger = logging.getLogger()

    # Set log level
    root_logger.setLevel(log_level)

    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)

    # Create and set formatter
    formatter = JsonFormatter()
    console_handler.setFormatter(formatter)

    # Add handler to the logger
    root_logger.addHandler(console_handler)

    # Log configuration complete
    root_logger.info(f"Logging configured with level {log_level_name}")


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger with the specified name.

    Args:
        name: Name for the logger, typically __name__

    Returns:
        logging.Logger: Configured logger instance
    """
    return logging.getLogger(name)


class LoggerAdapter(logging.LoggerAdapter):
    """
    Logger adapter to add context information to log records.
    """

    def __init__(self, logger: logging.Logger, extra: Optional[Dict[str, Any]] = None):
        """
        Initialize the adapter with a logger and optional extra context.

        Args:
            logger: Logger to adapt
            extra: Optional extra context to add to log records
        """
        super().__init__(logger, extra or {})

    def process(self, msg: str, kwargs: Dict[str, Any]) -> tuple:
        """
        Process the log message and kwargs.

        Args:
            msg: Log message
            kwargs: Keyword arguments for the log call

        Returns:
            tuple: Processed message and kwargs
        """
        if "extra" not in kwargs:
            kwargs["extra"] = {}

        kwargs["extra"].update(self.extra)

        return msg, kwargs


def get_logger_with_context(name: str, context: Dict[str, Any]) -> LoggerAdapter:
    """
    Get a logger with context information.

    Args:
        name: Name for the logger, typically __name__
        context: Context information to add to log records

    Returns:
        LoggerAdapter: Logger adapter with context
    """
    logger = get_logger(name)
    return LoggerAdapter(logger, context)
