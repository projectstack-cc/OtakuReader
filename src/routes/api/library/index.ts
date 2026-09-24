import { databaseService } from "~/services/database";

// GET /api/library -> stored manga. (The catch-all in [...path].ts needs at least one
// segment, so the bare collection URL is handled here.)
export async function GET() {
  try {
    return new Response(JSON.stringify(await databaseService.getAllMangas()), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Library unavailable" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
