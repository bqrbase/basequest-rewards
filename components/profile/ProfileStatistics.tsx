import ProfileStatCard from "@/components/profile/ProfileStatCard";
import { ui } from "@/lib/ui-styles";

type ProfileStatisticsProps = {
  walletAgeLabel: string | null;
  activeDays: number | null;
  transactions: number | null;
  ecosystemScore: number | null;
  loading: boolean;
};

function displayValue(
  loading: boolean,
  value: number | string | null,
): string | number | null {
  if (loading) {
    return null;
  }
  return value;
}

export default function ProfileStatistics({
  walletAgeLabel,
  activeDays,
  transactions,
  ecosystemScore,
  loading,
}: ProfileStatisticsProps) {
  return (
    <section className={ui.dashSection}>
      <div className={ui.sectionHeaderWrap}>
        <p className={ui.sectionHeading}>Overview</p>
        <h2 className={ui.sectionTitle}>Statistics</h2>
        <p className={ui.sectionDescription}>
          Core Base wallet metrics from your live analytics snapshot.
        </p>
      </div>

      <div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-4 sm:gap-4">
        <ProfileStatCard
          label="Wallet Age"
          value={displayValue(loading, walletAgeLabel)}
          hint={loading ? "Loading…" : walletAgeLabel ? "On Base" : "Unavailable"}
        />
        <ProfileStatCard
          label="Active Days"
          value={displayValue(loading, activeDays)}
          hint={loading ? "Loading…" : "Last 12 months"}
          accentClassName="text-cyan-100"
        />
        <ProfileStatCard
          label="Transactions"
          value={displayValue(loading, transactions)}
          hint={loading ? "Loading…" : "Outbound on Base"}
          accentClassName="text-white"
        />
        <ProfileStatCard
          label="Ecosystem Score"
          value={displayValue(loading, ecosystemScore)}
          hint={loading ? "Loading…" : "Protocol usage signal"}
          accentClassName="text-indigo-100"
        />
      </div>
    </section>
  );
}
