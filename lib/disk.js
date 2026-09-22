/**
 * CareFlow AI — Node persistence backend.
 *
 * Wires the environment-agnostic data layer (lib/db.js) to a JSON file on
 * disk. Importing this module registers the writer and loads any existing
 * snapshot, so server.js only needs to import it once.
 *
 * DATA_DIR lets a host point at a mounted persistent volume. If the
 * filesystem is read-only (serverless runtimes, ephemeral containers), the
 * data layer degrades to in-memory instead of crashing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, hydrate, resetDb, setPersistence } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
export const DB_FILE = path.join(DATA_DIR, 'db.json');

setPersistence((state) => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf8');
});

/** Read data/db.json into memory, seeding it on first ever boot. */
export function loadFromDisk() {
  try {
    hydrate(JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
  } catch {
    resetDb();
  }
  return db();
}

/** Wipe the snapshot back to the seeded hospital. */
export function resetOnDisk() {
  return resetDb();
}

export function storageInfo() {
  return { driver: 'json-file', dir: DATA_DIR, file: DB_FILE };
}
