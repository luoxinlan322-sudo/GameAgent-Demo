import { HistoryReplayViewer } from "@/components/history-replay-viewer";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ runId?: string }>;
}) {
  const params = await searchParams;
  return <HistoryReplayViewer runId={params.runId || ""} />;
}
