import { getVoter } from "@/lib/vote-auth";
import VoteLogin from "./VoteLogin";
import VoteBallot from "./VoteBallot";

export const dynamic = "force-dynamic";

export default async function VotePage() {
  const voter = await getVoter();
  if (!voter) return <VoteLogin />;
  return <VoteBallot />;
}