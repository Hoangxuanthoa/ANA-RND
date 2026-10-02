// A request body can arrive empty or truncated (e.g. React Strict Mode's
// dev-only double-invoke of an effect firing two overlapping fetches for
// the same POST, one of which the browser aborts mid-flight) — `.json()`
// throws SyntaxError on that, which otherwise 500s the whole route instead
// of a clean 400. Returns null on any parse failure.
export async function parseJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
