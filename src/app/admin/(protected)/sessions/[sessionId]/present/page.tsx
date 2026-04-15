import PresenterView from "@/components/admin/PresenterView";

type Params = { params: Promise<{ sessionId: string }> };

export default async function PresentPage({ params }: Params) {
  const { sessionId } = await params;
  return <PresenterView sessionId={sessionId} />;
}
