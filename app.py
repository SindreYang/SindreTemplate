"""Application factory for the Flask inference service."""

from __future__ import annotations

from flask import Flask, jsonify
from flask_cors import CORS

from conf.config import app_config, split_config


def create_app(config=None) -> Flask:
    """Create an application with safe defaults and JSON error responses.

    ``config`` may be a mapping (useful for tests) or a Flask config object.
    Heavy model dependencies are deliberately imported only for inference.
    """
    app = Flask(__name__)
    app.config.from_object(app_config)
    app.config.setdefault("SPLIT_CACHE_DIR", str(split_config.cache_dir))
    app.config.setdefault("SPLIT_MODELS", split_config.merger_args)

    if config is not None:
        if isinstance(config, dict):
            app.config.update(config)
        else:
            app.config.from_object(config)

    cache_dir = app.config["SPLIT_CACHE_DIR"]
    app.config["SPLIT_CACHE_DIR"] = str(cache_dir)
    origins = app.config["CORS_ORIGINS"]
    if isinstance(origins, str):
        origins = [origin.strip() for origin in origins.split(",") if origin.strip()]
    app.config["CORS_ORIGINS"] = origins
    CORS(app, resources={r"/*": {"origins": origins}})

    from routes import init_app

    init_app(app)

    @app.get("/health")
    def health():
        return jsonify(status="ok")

    @app.errorhandler(404)
    def not_found(error):
        return jsonify(error="Resource not found"), 404

    @app.errorhandler(405)
    def method_not_allowed(error):
        return jsonify(error="Method not allowed"), 405

    @app.errorhandler(413)
    def request_too_large(error):
        return jsonify(error="Uploaded request is too large"), 413

    @app.errorhandler(500)
    def internal_error(error):
        app.logger.exception("Unhandled application error", exc_info=error)
        return jsonify(error="Internal server error"), 500

    return app


if __name__ == "__main__":
    application = create_app()
    application.run(
        host=application.config["HOST"],
        port=application.config["PORT"],
        debug=application.config["DEBUG"],
    )
