"""Register the routes that are implemented in this repository."""


def init_app(app):
    from .examples import blueprint as examples_blueprint
    from .split import blueprint as split_blueprint, cleanup_expired_jobs

    app.register_blueprint(examples_blueprint)
    app.register_blueprint(split_blueprint)
    removed = cleanup_expired_jobs(
        app.config["SPLIT_CACHE_DIR"],
        int(app.config["SPLIT_CACHE_TTL_SECONDS"]),
    )
    if removed:
        app.logger.info("Removed %d expired inference job(s)", removed)
