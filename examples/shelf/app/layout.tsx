import type { ReactNode } from "react";
import { Link } from "harmony/router";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: "Georgia, serif", background: "#F4F1EA", color: "#10110F", minHeight: "100vh", margin: 0, padding: 24 }}>
      <nav style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 28 }}>
        <span style={{ width: 10, height: 10, background: "#D6FF4A", display: "inline-block" }} />
        <Link href="/">Shelf</Link>
        <Link href="/volume/saturn">Saturn</Link>
      </nav>
      {children}
    </div>
  );
}
