import type { APIRoute } from 'astro';
import { writeFile, mkdir, readdir, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const prerender = false;

interface UploadedModel {
  id: string;
  name: string;
  description: string;
  tags: string[];
  filename: string;
  size: number;
  uploadedAt: number;
  metadata: Record<string, unknown>;
}

const MODELS_DIR = join(process.cwd(), 'public', 'models');
const METADATA_FILE = join(MODELS_DIR, 'metadata.json');

async function ensureModelsDir() {
  await mkdir(MODELS_DIR, { recursive: true });
}

async function loadMetadata(): Promise<UploadedModel[]> {
  try {
    const content = await readFile(METADATA_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function saveMetadata(models: UploadedModel[]) {
  await writeFile(METADATA_FILE, JSON.stringify(models, null, 2));
}

export const POST: APIRoute = async ({ request }) => {
  try {
    await ensureModelsDir();

    const formData = await request.formData();

    const file = formData.get('file') as File | null;
    const name = (formData.get('name') as string) || '';
    const description = (formData.get('description') as string) || '';
    const tags = (formData.get('tags') as string) || '';
    const metadata = (formData.get('metadata') as string) || '{}';

    if (!file) {
      return new Response(
        JSON.stringify({ success: false, error: 'No file provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!file.name.toLowerCase().endsWith('.stl')) {
      return new Response(
        JSON.stringify({ success: false, error: 'File must be an STL file (.stl)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Limit file size to 50MB
    if (file.size > 50 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ success: false, error: 'File size exceeds 50MB limit' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const timestamp = Date.now();
    const uuid = randomUUID().slice(0, 8);
    const safeName = name.trim() || file.name.replace(/\.stl$/i, '');
    const sanitizedName = safeName.replace(/[^a-z0-9_\-\.]/gi, '_');
    const filename = `${sanitizedName}_${timestamp}_${uuid}.stl`;
    const filepath = join(MODELS_DIR, filename);

    await writeFile(filepath, buffer);

    let parsedTags: string[] = [];
    try {
      parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);
    } catch {
      parsedTags = [];
    }

    let parsedMetadata: Record<string, unknown> = {};
    try {
      parsedMetadata = JSON.parse(metadata);
    } catch {
      parsedMetadata = {};
    }

    const model: UploadedModel = {
      id: `upload-${timestamp}-${uuid}`,
      name: safeName,
      description: description.trim(),
      tags: parsedTags,
      filename,
      size: buffer.length,
      uploadedAt: timestamp,
      metadata: parsedMetadata,
    };

    const existingModels = await loadMetadata();
    existingModels.push(model);
    await saveMetadata(existingModels);

    return new Response(
      JSON.stringify({ success: true, model }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('STL upload error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const GET: APIRoute = async () => {
  try {
    const models = await loadMetadata();
    return new Response(
      JSON.stringify({ success: true, models }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('STL list error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing model ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const models = await loadMetadata();
    const idx = models.findIndex(m => m.id === id);
    if (idx === -1) {
      return new Response(
        JSON.stringify({ success: false, error: 'Model not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const model = models[idx];
    const filepath = join(MODELS_DIR, model.filename);
    try {
      await unlink(filepath);
    } catch {
      // ignore if file doesn't exist
    }

    models.splice(idx, 1);
    await saveMetadata(models);

    return new Response(
      JSON.stringify({ success: true, message: 'Model deleted' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('STL delete error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};