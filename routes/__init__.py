"""Register the routes that are implemented in this repository."""


def init_app(app):
    from .split import blueprint as split_blueprint

    app.register_blueprint(split_blueprint)
