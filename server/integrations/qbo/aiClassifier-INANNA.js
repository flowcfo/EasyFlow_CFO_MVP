/**
 * Optional Claude-based classification for unmatched QBO accounts.
 * Returns an empty list when no API key or no unmatched rows (handled in mapper).
 */
export async function aiClassify(unmatched, _businessType) {
  if (!unmatched?.length) return [];
  return [];
}
