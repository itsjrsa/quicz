import PlayView from "@/components/participant/PlayView";

type Params = { params: Promise<{ sessionCode: string }> };

export default async function PlayPage({ params }: Params) {
  const { sessionCode } = await params;
  return <PlayView sessionCode={sessionCode.toUpperCase()} />;
}
