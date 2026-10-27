import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>Lingua</h1>
      <p>Personal fluency practice — listening &amp; speaking first.</p>
      <nav style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
        <Link href="/review">Review queue</Link>
        <Link href="/chat">Chat practice</Link>
      </nav>
    </main>
  );
}
