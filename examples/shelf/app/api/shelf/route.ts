import { SHELF } from "../../data";

export function GET() {
  return Response.json({ shelf: SHELF });
}
