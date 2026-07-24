"use client";

import {
  FarcasterIcon,
  XIcon,
} from "@/components/icons/SocialIcons";
import QuestCard from "@/components/QuestCard";
import { COMMUNITY_QUESTS } from "@/lib/community-quests";
import {
  isCommunityEngineQuest,
  isSpecialBuilderQuest,
  type QuestId,
  type QuestProgress,
  type QuestStatus,
  type QuestViewModel,
} from "@/lib/quest-engine";

function CommunityQuestIcon({ icon }: { icon: "x" | "farcaster" }) {
  if (icon === "x") {
    return <XIcon className="size-3.5" />;
  }

  return <FarcasterIcon className="size-3.5" />;
}

type CommunityQuestCardsProps = {
  quests: QuestViewModel[];
  onFollowXCompleted: (progress: QuestProgress) => void;
};

/**
 * Community follow quests.
 * follow-x uses X OAuth + verify-follow.
 * follow-farcaster uses Neynar verify-follow for @hqc.
 */
export default function CommunityQuestCards({
  quests,
  onFollowXCompleted,
}: CommunityQuestCardsProps) {
  const followXQuest = quests.find((quest) => quest.id === "follow-x");
  const followFarcasterQuest = quests.find(
    (quest) => quest.id === "follow-farcaster",
  );

  return (
    <>
      {COMMUNITY_QUESTS.map((quest) => {
        const icon = <CommunityQuestIcon icon={quest.icon} />;

        if (quest.id === "follow-x") {
          const status: QuestStatus = followXQuest?.status ?? "available";
          const reward = followXQuest?.reward ?? `+${quest.rewardXp} XP`;

          return (
            <QuestCard
              key={quest.id}
              questId={quest.id}
              title={quest.title}
              description={quest.description}
              reward={reward}
              status={status}
              ctaLabel={status === "completed" ? "Completed" : "Connect X"}
              frequencyLabel="One-Time"
              icon={icon}
              onServerProgress={onFollowXCompleted}
            />
          );
        }

        if (quest.id === "follow-farcaster") {
          const status: QuestStatus =
            followFarcasterQuest?.status ?? "available";
          const reward =
            followFarcasterQuest?.reward ?? `+${quest.rewardXp} XP`;

          return (
            <QuestCard
              key={quest.id}
              questId={quest.id}
              title={quest.title}
              description={quest.description}
              reward={reward}
              status={status}
              ctaLabel={quest.ctaLabel}
              frequencyLabel="One-Time"
              icon={icon}
              onServerProgress={onFollowXCompleted}
            />
          );
        }

        return null;
      })}
    </>
  );
}

export function filterBuilderQuests<T extends { id: QuestId }>(
  quests: T[],
): T[] {
  return quests.filter(
    (quest) =>
      !isCommunityEngineQuest(quest.id) && !isSpecialBuilderQuest(quest.id),
  );
}
