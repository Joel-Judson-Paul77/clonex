import { NextResponse, connection } from "next/server";
import { evaluateAll } from "@/lib/evalset";

// Runs the labelled look-alike test set through the real detection code and reports accuracy.
// connection() keeps it out of the build-time prerender, so the Accuracy tab really is computed live.
export async function GET() {
  await connection();
  return NextResponse.json(evaluateAll(), { headers: { "Cache-Control": "no-store" } });
}
