#!/usr/bin/env python3
"""
Batch upload all generated STL files from freecad generated_models directory
to the yoimagine Tools server API.
"""

import json
import os
import sys
import subprocess
from pathlib import Path

MODELS_DIR = Path("/mnt/minissd/home/us1/code/3dworks/freecad/generated_models")
API_URL = "http://127.0.0.1:4321/api/upload-stl/"


def upload_file(file_path: Path, name: str, description: str = "", tags: str = "") -> bool:
    """Upload a single STL file via curl."""
    meta = json.dumps({
        "source": "freecad-generated",
        "originalFilename": file_path.name
    })
    
    cmd = [
        "curl", "-s", "--max-time", "30",
        "-F", f"file=@{file_path}",
        "-F", f"name={name}",
        "-F", f"description={description}",
        "-F", f"tags={tags}",
        "-F", f"metadata={meta}",
        API_URL
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=35)
        if result.returncode == 0 and '"success":true' in result.stdout:
            return True
        else:
            print(f"  ✗ Failed: {result.stdout[:200]}")
            return False
    except subprocess.TimeoutExpired:
        print(f"  ✗ Timeout")
        return False
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def main():
    stl_files = sorted(MODELS_DIR.glob("*.stl"))
    print(f"Found {len(stl_files)} STL files to upload\n")
    
    # Start server
    print("Starting server...")
    server_proc = subprocess.Popen(
        ["node", "/mnt/minissd/home/us1/code/mastersite/tools-hub/dist/server/entry.mjs"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    
    import time
    time.sleep(2)
    
    # Quick health check
    try:
        import requests
        requests.get("http://127.0.0.1:4321/api/upload-stl/", timeout=2)
    except:
        print("Server not responding")
        server_proc.terminate()
        return
    
    uploaded = 0
    failed = 0
    
    for i, stl in enumerate(stl_files, 1):
        # Parse name from filename
        name = stl.stem.replace("_", " ").replace("-", " ")
        
        # Guess tags from name
        tags = []
        name_lower = name.lower()
        if "gear" in name_lower: tags.append("gear")
        if "bracket" in name_lower: tags.append("bracket")
        if "mount" in name_lower: tags.append("mount")
        if "box" in name_lower: tags.append("box")
        if "enclosure" in name_lower: tags.append("enclosure")
        if "top" in name_lower: tags.append("toy")
        if "puzzle" in name_lower: tags.append("puzzle")
        if "hinge" in name_lower: tags.append("mechanical")
        
        tag_str = ",".join(tags) if tags else "freecad,generated"
        
        print(f"[{i}/{len(stl_files)}] {name}...", end=" ")
        if upload_file(stl, name, f"Generated model: {name}", tag_str):
            print("✓")
            uploaded += 1
        else:
            print("✗")
            failed += 1
    
    server_proc.terminate()
    print(f"\nDone: {uploaded} uploaded, {failed} failed")


if __name__ == "__main__":
    main()