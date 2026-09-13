#!/usr/bin/env python3
"""
STL Upload Script for yoimagine Tools (Static Site Generator)

This script helps you add STL files to the local model library by:
1. Copying STL files to public/models/
2. Generating/updating the metadata.json file
3. Commit and push to deploy

Usage:
    python upload_stl.py path/to/model.stl --name "My Model" --desc "Description" --tags "tag1,tag2" --meta '{"key": "value"}'
    python upload_stl.py path/to/model.stl  # minimal upload
    python upload_stl.py --list  # list existing models
"""

import argparse
import json
import os
import shutil
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

# Project root (where this script lives: scripts/upload_stl.py)
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
MODELS_DIR = PROJECT_ROOT / "public" / "models"
METADATA_FILE = MODELS_DIR / "metadata.json"


def load_metadata() -> list:
    """Load existing metadata from file."""
    try:
        with open(METADATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def save_metadata(metadata: list) -> None:
    """Save metadata to file."""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    with open(METADATA_FILE, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)


def upload_stl(
    file_path: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    tags: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> dict:
    """
    Add an STL file to the local model library.

    Args:
        file_path: Path to the .stl file
        name: Model name (defaults to filename)
        description: Model description
        tags: Comma-separated tags string
        metadata: Additional metadata as dict

    Returns:
        Model info dict
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    if path.suffix.lower() != ".stl":
        raise ValueError("File must have .stl extension")

    # Load existing metadata
    existing = load_metadata()

    # Prepare model info
    timestamp = int(datetime.now().timestamp() * 1000)
    uid = uuid.uuid4().hex[:8]
    safe_name = (name or path.stem).strip()
    filename = f"{safe_name.replace(' ', '_')}_{timestamp}_{uid}.stl"

    # Copy file to models directory
    dest_path = MODELS_DIR / filename
    shutil.copy2(path, dest_path)

    file_size = dest_path.stat().st_size

    # Parse tags
    parsed_tags = []
    if tags:
        parsed_tags = [t.strip() for t in tags.split(",") if t.strip()]

    model = {
        "id": f"upload-{timestamp}-{uid}",
        "name": safe_name,
        "description": description or "",
        "tags": parsed_tags,
        "filename": filename,
        "size": file_size,
        "uploadedAt": timestamp,
        "metadata": metadata or {},
    }

    existing.append(model)
    save_metadata(existing)

    return model


def list_models() -> list:
    """List all models in the local library."""
    return load_metadata()


def main():
    parser = argparse.ArgumentParser(
        description="Add STL files to yoimagine Tools local model library",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python upload_stl.py ~/models/gear.stl --name "Spur Gear" --desc "16-tooth spur gear" --tags "gear,mechanical"
  python upload_stl.py ~/models/cube.stl --meta '{"printTime": "2h", "material": "PLA"}'
  python upload_stl.py --list
        """
    )
    parser.add_argument("file", nargs="?", help="Path to STL file")
    parser.add_argument("--name", help="Model name (default: filename without extension)")
    parser.add_argument("--desc", "--description", dest="description", help="Model description")
    parser.add_argument("--tags", help="Comma-separated tags (e.g., 'mechanical,gear,test')")
    parser.add_argument("--meta", "--metadata", dest="metadata", help="JSON metadata string")
    parser.add_argument("--list", action="store_true", help="List existing models instead of uploading")

    args = parser.parse_args()

    if args.list:
        models = list_models()
        if not models:
            print("No models found in local library.")
            return
        print(f"Found {len(models)} model(s) in local library:\n")
        for m in models:
            print(f"  ID: {m.get('id')}")
            print(f"  Name: {m.get('name')}")
            print(f"  Description: {m.get('description', '(none)')}")
            print(f"  Tags: {', '.join(m.get('tags', [])) or '(none)'}")
            print(f"  Filename: {m.get('filename')}")
            print(f"  Size: {m.get('size', 0) / 1024:.1f} KB")
            print(f"  Uploaded: {datetime.fromtimestamp(m.get('uploadedAt', 0) / 1000).strftime('%Y-%m-%d %H:%M')}")
            if m.get("metadata"):
                print(f"  Metadata: {json.dumps(m['metadata'])}")
            print()
        return

    if not args.file:
        parser.error("File argument is required (use --list to view models)")

    try:
        meta = None
        if args.metadata:
            try:
                meta = json.loads(args.metadata)
            except json.JSONDecodeError as e:
                print(f"Invalid JSON metadata: {e}", file=sys.stderr)
                sys.exit(1)

        model = upload_stl(
            file_path=args.file,
            name=args.name,
            description=args.description,
            tags=args.tags,
            metadata=meta,
        )

        print("✓ Model added to local library!")
        print(f"  ID: {model['id']}")
        print(f"  Name: {model['name']}")
        print(f"  Filename: {model['filename']}")
        print(f"  Size: {model['size'] / 1024:.1f} KB")
        print(f"  Tags: {', '.join(model['tags']) or '(none)'}")
        print(f"  Copied to: {MODELS_DIR / model['filename']}")
        print(f"  Metadata updated: {METADATA_FILE}")
        print("\nNext steps:")
        print("  1. git add public/models/")
        print("  2. git commit -m 'Add STL model: <name>'")
        print("  3. git push")

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()