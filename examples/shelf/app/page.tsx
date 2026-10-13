import { useEffect, useState } from "react";
import { Link } from "harmony/router";

type Volume = { id: string; title: string; author: string; notes: number };

export default function Home() {
  const [shelf, setShelf] = useState<Volume[]>([]);
  useEffect(() => {
    void fetch("/api/shelf")
      .then((response) => response.json())
      .then((body: { shelf: Volume[] }) => setShelf(body.shelf));
  }, []);
  return (
    <main>
      <h1 style={{ fontWeight: 500, fontSize: 40, margin: "0 0 8px" }}>The shelf</h1>
      <p style={{ marginTop: 0 }}>A screen. The list comes from a route handler.</p>
      <ul style={{ padding: 0, listStyle: "none" }}>
        {shelf.map((volume) => (
          <li key={volume.id} style={{ padding: "12px 0", borderTop: "1px solid rgba(16,17,15,0.15)" }}>
            <Link href={`/volume/${volume.id}`}>{volume.title}</Link>
            <div style={{ opacity: 0.7 }}>{volume.author}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}
