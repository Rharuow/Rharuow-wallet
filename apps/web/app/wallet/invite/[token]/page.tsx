import { redirect } from "next/navigation";

export default async function LegacyWalletInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  redirect(`/convites/${token}`);
}