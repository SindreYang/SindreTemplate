"""Regenerate Python bindings from Qt Designer forms."""

from pathlib import Path

from PyQt5.uic import compileUi

ROOT = Path(__file__).parent


def generate() -> None:
    """Compile every form into the generated bindings directory."""
    source_dir = ROOT / "forms"
    output_dir = ROOT / "generated"
    output_dir.mkdir(exist_ok=True)
    for form in source_dir.glob("*.ui"):
        with (output_dir / f"{form.stem}.py").open("w", encoding="utf-8") as output:
            compileUi(str(form), output, from_imports=True)


if __name__ == "__main__":
    generate()
