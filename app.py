"""Application factory for the Flask inference service."""

from flask import Flask, jsonify
from flask_cors import CORS

from conf.config import app_config, split_config


def create_app(config=None):
    """Create and configure the Flask application.

    ``config`` may be a mapping (useful for tests) or a Flask config object.
    Optional model dependencies are deliberately not imported at startup.
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

    CORS(app, resources={r"/*": {"origins": app.config["CORS_ORIGINS"]}})

    from routes import init_app

    init_app(app)

    @app.get("/health")
    def health():
        return jsonify(status="ok")

    return app


if __name__ == "__main__":
    application = create_app()
    application.run(
        host="0.0.0.0",
        port=5000,
        debug=application.config["DEBUG"],
    )
