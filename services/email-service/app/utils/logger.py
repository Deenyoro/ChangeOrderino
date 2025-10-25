"""Logging configuration"""
import logging
import sys
from typing import Optional

from app.config import config


def setup_logger(name: Optional[str] = None) -> logging.Logger:
    """
    Setup logger with consistent formatting

    Args:
        name: Logger name (defaults to root logger)

    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name or __name__)

    # Only configure if not already configured
    if not logger.handlers:
        logger.setLevel(getattr(logging, config.LOG_LEVEL.upper()))

        # Console handler
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(getattr(logging, config.LOG_LEVEL.upper()))

        # Format: timestamp [LEVEL] logger_name - message
        formatter = logging.Formatter(
            fmt='%(asctime)s [%(levelname)s] %(name)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        handler.setFormatter(formatter)

        logger.addHandler(handler)

    return logger


# Global logger instance
logger = setup_logger("email_service")
