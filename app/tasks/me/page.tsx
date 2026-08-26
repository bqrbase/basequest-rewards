import ShareRewardsCard from "@/components/task2earn/ShareRewardsCard";
import Task2EarnShell from "@/components/task2earn/Task2EarnShell";

export default function TaskStatsPage() {
  return (
    <Task2EarnShell>
      <header>
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-cyan-200/60">
          Task2Earn
        </p>
        <h1 className="mt-1 font-sans text-xl font-bold text-white">My Stats</h1>
      </header>
      <ShareRewardsCard />
    </Task2EarnShell>
  );
}
