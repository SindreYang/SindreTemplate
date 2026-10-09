"""Application factory for the Flask inference service."""

from __future__ import annotations

from flask import Flask
from flask_cors import CORS

from conf.config import app_config, split_config
from services.logging import configure_logging
from services.response import error as json_error, success


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

    configure_logging(app)

    cache_dir = app.config["SPLIT_CACHE_DIR"]
    app.config["SPLIT_CACHE_DIR"] = str(cache_dir)
    origins = app.config["CORS_ORIGINS"]
    if isinstance(origins, str):
        origins = [origin.strip() for origin in origins.split(",") if origin.strip()]
    app.config["CORS_ORIGINS"] = origins
    CORS(
        app,
        resources={r"/*": {"origins": origins}},
        send_wildcard=origins == ["*"],
    )

    from routes import init_app

    init_app(app)

    @app.get("/health")
    def health():
        return success({"status": "ok"})

    @app.errorhandler(404)
    def not_found(_error):
        return json_error("Resource not found", 404, "not_found")

    @app.errorhandler(405)
    def method_not_allowed(_error):
        return json_error("Method not allowed", 405, "method_not_allowed")

    @app.errorhandler(413)
    def request_too_large(_error):
        return json_error("Uploaded request is too large", 413, "request_too_large")

    @app.errorhandler(500)
    def internal_error(_error):
        app.logger.exception("Unhandled application error", exc_info=_error)
        return json_error("Internal server error", 500, "internal_error")

    return app


if __name__ == "__main__":
    application = create_app()
    application.run(
        host=application.config["HOST"],
        port=application.config["PORT"],
        debug=application.config["DEBUG"],
    )
