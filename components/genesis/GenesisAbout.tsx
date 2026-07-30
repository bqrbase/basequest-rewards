import GlassPanel from "@/components/GlassPanel";
import { ui } from "@/lib/ui-styles";

export default function GenesisAbout() {
  return (
    <section className={ui.dashSection}>
      <div className={ui.sectionHeaderWrap}>
        <p className={ui.sectionHeading}>About</p>
        <h2 className={ui.sectionTitle}>The Founding Collection</h2>
      </div>

      <GlassPanel className={`${ui.dashCardPad} sm:p-8`}>
        <div className="space-y-4 text-sm leading-relaxed text-white/65 sm:text-base sm:leading-7">
          <p>
            BaseQuest Genesis is the founding NFT collection of the BaseQuest
            ecosystem on Base. Built as a limited ERC-1155 set of 1,000 unique
            tokens, Genesis marks the origin of BaseQuest onchain identity,
            culture, and long-term participation.
          </p>
          <p>
            Each Genesis NFT represents early alignment with the project’s
            mission: rewarding meaningful onchain activity, building community
            ownership, and expanding utility across quests, rewards, and future
            BaseQuest experiences.
          </p>
          <p>
            The collection is permanently capped, deployed on Base Mainnet, and
            designed as a durable foundation for holders as BaseQuest continues
            to grow.
          </p>
        </div>
      </GlassPanel>
    </section>
  );
}
