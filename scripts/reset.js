import { DB_FILE, resetOnDisk } from '../lib/disk.js';

resetOnDisk();
console.log(`CareFlow AI demo data reset to the seeded state (${DB_FILE}).`);
