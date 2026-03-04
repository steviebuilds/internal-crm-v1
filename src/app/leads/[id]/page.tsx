import { redirect } from "next/navigation";

type LegacyLeadPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LegacyLeadPage({ params }: LegacyLeadPageProps) {
  const { id } = await params;
  redirect(`/companies/${id}`);
}
