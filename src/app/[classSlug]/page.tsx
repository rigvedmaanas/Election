import { ClassVotingKiosk } from "@/components/ClassVotingKiosk";
import { slugToClass } from "@/lib/classes";
import { notFound } from "next/navigation";

export default async function ClassPage({
  params,
}: {
  params: Promise<{ classSlug: string }>;
}) {
  const { classSlug } = await params;
  const className = slugToClass(classSlug);

  if (!className) {
    notFound();
  }

  return <ClassVotingKiosk className={className} />;
}
