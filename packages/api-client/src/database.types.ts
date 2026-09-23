/**
 * Re-exports Supabase schema types.
 * Sprint 4: uses extended Database (soft-delete + new tables) until
 * `pnpm db:types` regenerates database.generated.ts from local DB.
 */
export type { Json, Tables, TablesInsert, TablesUpdate, Enums } from './database.generated';
export type { Database } from './database.extended';
