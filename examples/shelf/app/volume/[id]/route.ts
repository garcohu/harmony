import { SHELF } from "../../data";

export function GET(_request: Request, context: { params: { id: string } }) {
  const id = context.params.id.toLowerCase();
  const volume = SHELF.find((item) => item.id === id || item.title.toLowerCase().includes(id));
  if (!volume) return Response.json({ error: "No volume." }, { status: 404 });
  return Response.json(volume);
}
