#!/usr/bin/env python3
"""
STL Upload Script for yoimagine Tools Server API

Upload STL files to the server API endpoint with description, tags, and metadata.

Usage:
    python upload_stl_server.py path/to/model.stl --name "My Model" --desc "Description" --tags "tag1,tag2" --meta '{"key": "value"}'
    python upload_stl_server.py --list  # list existing models
    python upload_stl_server.py --delete <model-id>  # delete a model
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Optional, Dict, Any

import requests


DEFAULT_API_URL = os.environ.get("STL_API_URL", "https://tools.yoimagine.com/api/upload-stl")


def upload_stl(
    file_path: str,
    api_url: str = DEFAULT_API_URL,
    name: Optional[str] = None,
    description: Optional[str] = None,
    tags: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> dict:
    """
    Upload an STL file to the server API.

    Args:
        file_path: Path to the .stl file
        api_url: API endpoint URL
        name: Model name (defaults to filename)
        description: Model description
        tags: Comma-separated tags string
        metadata: Additional metadata as dict

    Returns:
        API response dict
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    if path.suffix.lower() != ".stl":
        raise ValueError("File must have .stl extension")

    # Prepare form data
    with open(path, "rb") as f:
        files = {"file": (path.name, f, "application/octet-stream")}
        data = {}

        if name:
            data["name"] = name
        if description:
            data["description"] = description
        if tags:
            data["tags"] = tags
        if metadata:
            data["metadata"] = json.dumps(metadata)

        response = requests.post(api_url, files=files, data=data, timeout=60)

    if not response.ok:
        try:
            error_data = response.json()
            raise RuntimeError(f"API error ({response.status_code}): {error_data.get('error', response.text)}")
        except json.JSONDecodeError:
            raise RuntimeError(f"API error ({response.status_code}): {response.text}")

    return response.json()


def list_models(api_url: str = DEFAULT_API_URL) -> list:
    """List all uploaded models from server."""
    response = requests.get(api_url, timeout=30)
    if not response.ok:
        raise RuntimeError(f"List error ({response.status_code}): {response.text}")
    return response.json().get("models", [])


def delete_model(model_id: str, api_url: str = DEFAULT_API_URL) -> dict:
    """Delete a model from server."""
    response = requests.delete(f"{api_url}?id={model_id}", timeout=30)
    if not response.ok:
        try:
            error_data = response.json()
            raise RuntimeError(f"Delete error ({response.status_code}): {error_data.get('error', response.text)}")
        except json.JSONDecodeError:
            raise RuntimeError(f"Delete error ({response.status_code}): {response.text}")
    return response.json()


def main():
    parser = argparse.ArgumentParser(
        description="Upload/manage STL files via yoimagine Tools Server API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"""
Examples:
  python upload_stl_server.py ~/models/gear.stl --name "Spur Gear" --desc "16-tooth spur gear" --tags "gear,mechanical"
  python upload_stl_server.py ~/models/cube.stl --meta '{{"printTime": "2h", "material": "PLA"}}'
  python upload_stl_server.py --list
  python upload_stl_server.py --delete upload-1234567890-abcdef

Environment variables:
  STL_API_URL  - API endpoint (default: https://tools.yoimagine.com/api/upload-stl)

Default API URL: {DEFAULT_API_URL}
        """
    )
    parser.add_argument("file", nargs="?", help="Path to STL file (required for upload)")
    parser.add_argument("--url", default=DEFAULT_API_URL, help="API endpoint URL")
    parser.add_argument("--name", help="Model name (default: filename without extension)")
    parser.add_argument("--desc", "--description", dest="description", help="Model description")
    parser.add_argument("--tags", help="Comma-separated tags (e.g., 'mechanical,gear,test')")
    parser.add_argument("--meta", "--metadata", dest="metadata", help="JSON metadata string")
    parser.add_argument("--list", action="store_true", help="List existing models")
    parser.add_argument("--delete", help="Delete model by ID")

    args = parser.parse_args()

    if args.list:
        try:
            models = list_models(args.url)
            if not models:
                print("No models found on server.")
                return
            print(f"Found {len(models)} model(s) on server:\n")
            for m in models:
                print(f"  ID: {m.get('id')}")
                print(f"  Name: {m.get('name')}")
                print(f"  Description: {m.get('description', '(none)')}")
                print(f"  Tags: {', '.join(m.get('tags', [])) or '(none)'}")
                print(f"  Filename: {m.get('filename')}")
                print(f"  Size: {m.get('size', 0) / 1024:.1f} KB")
                print(f"  Uploaded: {m.get('uploadedAt', 0)}")
                if m.get("metadata"):
                    print(f"  Metadata: {json.dumps(m['metadata'])}")
                print()
        except Exception as e:
            print(f"Error listing models: {e}", file=sys.stderr)
            sys.exit(1)
        return

    if args.delete:
        try:
            result = delete_model(args.delete, args.url)
            if result.get("success"):
                print(f"✓ Model deleted: {args.delete}")
            else:
                print(f"✗ Delete failed: {result.get('error', 'Unknown error')}", file=sys.stderr)
                sys.exit(1)
        except Exception as e:
            print(f"Error deleting model: {e}", file=sys.stderr)
            sys.exit(1)
        return

    if not args.file:
        parser.error("File argument is required (use --list to view models, or --delete <id> to delete)")

    try:
        meta = None
        if args.metadata:
            try:
                meta = json.loads(args.metadata)
            except json.JSONDecodeError as e:
                print(f"Invalid JSON metadata: {e}", file=sys.stderr)
                sys.exit(1)

        result = upload_stl(
            file_path=args.file,
            api_url=args.url,
            name=args.name,
            description=args.description,
            tags=args.tags,
            metadata=meta,
        )

        if result.get("success"):
            model = result.get("model", {})
            print("✓ Upload successful!")
            print(f"  ID: {model.get('id')}")
            print(f"  Name: {model.get('name')}")
            print(f"  Filename: {model.get('filename')}")
            print(f"  Size: {model.get('size', 0) / 1024:.1f} KB")
            print(f"  Tags: {', '.join(model.get('tags', [])) or '(none)'}")
            print(f"  URL: {args.url.replace('/api/upload-stl', '')}/models/{model.get('filename')}")
        else:
            print(f"✗ Upload failed: {result.get('error', 'Unknown error')}", file=sys.stderr)
            sys.exit(1)

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()