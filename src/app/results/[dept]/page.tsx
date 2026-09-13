import { getDb } from "@/lib/mongodb";
import { getPublicResults } from "@/lib/vote-results";
import ResultsView from "./ResultsView";

export const dynamic = "force-dynamic";

export default async function ResultsPage({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  const db = await getDb();
  const data = await getPublicResults(db, dept);

  if (!data.published) {
    return (
      <main className="pay-main">
        <div className="pay-wrap" style={{ textAlign: "center" }}>
          <h1 className="result-title">Results not out yet</h1>
          <p className="muted">Award results will be published after the dinner. Check back soon.</p>
        </div>
      </main>
    );
  }
  return <ResultsView data={data} />;
}