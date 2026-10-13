import { useEffect, useState } from "react";
import { useParams } from "harmony/router";

export default function Volume() {
  const { id } = useParams();
  const [volume, setVolume] = useState<{ title?: string; author?: string; notes?: number; error?: string } | null>(null);
  useEffect(() => {
    void fetch(`/volume/${id}`)
      .then((response) => response.json())
      .then(setVolume);
  }, [id]);
  return (
    <article>
      <h1 style={{ fontWeight: 500, fontSize: 40, marginBottom: 8 }}>{volume?.title ?? id}</h1>
      <p style={{ marginTop: 0 }}>{volume ? `${volume.author ?? ""} · ${volume.notes ?? 0} notes` : "Opening."}</p>
    </article>
  );
}
