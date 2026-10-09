"""WSGI entry point for Gunicorn, Waitress, or another process manager."""

from app import create_app

app = create_app()
