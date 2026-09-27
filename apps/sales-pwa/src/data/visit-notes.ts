/**
 * Notes to send with a visit status change.
 * Untouched field → keep the stored notes. Edited to blank → clear.
 */
export function resolveVisitNotesForUpdate(
  editedNotes: string | undefined,
  storedNotes: string | null,
): string | null {
  if (editedNotes === undefined) return storedNotes;
  return editedNotes.trim() || null;
}
