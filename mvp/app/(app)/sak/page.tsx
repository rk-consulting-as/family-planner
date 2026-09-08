import { getActiveContext } from "@/lib/queries";
import { getCaseEvents, getCaseDocuments } from "@/lib/actions/case";
import SakClient from "./SakClient";
import { redirect } from "next/navigation";

export default async function SakPage() {
  const ctx = await getActiveContext();
  if (!ctx) redirect("/login");

  const [events, documents] = await Promise.all([
    getCaseEvents(),
    getCaseDocuments(),
  ]);

  return <SakClient events={events} documents={documents} />;
}
