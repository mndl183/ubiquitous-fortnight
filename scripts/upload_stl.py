#!/usr/bin/env python3
"""
STL Upload Script for yoimagine Tools Server API

Upload STL files to the server API with description, tags, and metadata.

Usage:
    python upload_stl.py path/to/model.stl --name "My Model" --desc "Description" --tags "tag1,tag2" --meta '{"key": "value"}'
    python upload_stl.py --list  # list existing models
    python upload_stl.py --delete <model-id>  # delete a model
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
    """Upload an STL file with metadata to the server API."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
    if path.suffix.lower() != ".stl":
        raise ValueError("File must have .stl extension")

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
            err = response.json().get("error", response.text)
        except json.JSONDecodeError:
            err = response.text
        raise RuntimeError(f"API error ({response.status_code}): {err}")

    return response.json()


def list_models(api_url: str = DEFAULT_API_URL) -> list:
    """List all models from the server."""
    response = requests.get(api_url, timeout=30)
    if not response.ok:
        raise RuntimeError(f"List failed: {response.status_code} {response.text}")
    return response.json().get("models", [])


def delete_model(model_id: str, api_url: str = DEFAULT_API_URL) -> dict:
    """Delete a model by ID."""
    response = requests.delete(f"{api_url}?id={model_id}", timeout=30)
    if not response.ok:
        raise RuntimeError(f"Delete failed: {response.status_code} {response.text}")
    return response.json()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Upload STL with metadata to yoimagine Tools")
    parser.add_argument("file", nargs="?", help="Path to .stl file")
    parser.add_argument("--url", default=DEFAULT_API_URL, help="API endpoint")
    parser.add_argument("--name", help="Model name")
    parser.add_argument("--desc", "--description", dest="description", help="Description")
    parser.add_argument("--tags", help="Comma-separated tags")
    parser.add_argument("--meta", "--metadata", dest="metadata", help="JSON metadata")
    parser.add_argument("--list", action="store_true", help="List models")
    parser.add_argument("--delete", help="Delete model by ID")
    args = parser.parse_args()

    if args.list:
        models = list_models(args.url)
        for m in models:
            print(f"  {m['id']} | {m['name']} | tags: {', '.join(m['tags']) or 'none'}")
        sys.exit(0)

    if args.delete:
        print(f"Deleted: {delete_model(args.delete, args.url).get('message')}")
        sys.exit(0)

    if not args.file:
        parser.error("File required (or use --list / --delete)")

    meta = json.loads(args.metadata) if args.metadata else None
    result = upload_stl(args.file, args.url, args.name, args.description, args.tags, meta)

    if result.get("success"):
        m = result["model"]
        print(f"✓ Uploaded: {m['id']}")
        print(f"  Name: {m['name']}")
        print(f"  File: /models/{m['filename']}")
    else:
        print(f"✗ Failed: {result.get('error')}")
        sys.exit(1)