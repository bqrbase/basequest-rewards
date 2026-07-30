"use client";

import GenesisAbout from "@/components/genesis/GenesisAbout";
import GenesisBenefits from "@/components/genesis/GenesisBenefits";
import GenesisContract from "@/components/genesis/GenesisContract";
import GenesisDetails from "@/components/genesis/GenesisDetails";
import GenesisFadeIn from "@/components/genesis/GenesisFadeIn";
import GenesisFeaturedNft from "@/components/genesis/GenesisFeaturedNft";
import GenesisHero from "@/components/genesis/GenesisHero";
import GenesisProgress from "@/components/genesis/GenesisProgress";
import GenesisRoadmap from "@/components/genesis/GenesisRoadmap";
import GenesisStats from "@/components/genesis/GenesisStats";
import GenesisStatus from "@/components/genesis/GenesisStatus";
import PageShell from "@/components/PageShell";
import { useGenesisSupply } from "@/hooks/useGenesisSupply";

export default function GenesisPage() {
  const supply = useGenesisSupply();

  return (
    <PageShell>
      <GenesisFadeIn>
        <GenesisStatus />
      </GenesisFadeIn>
      <GenesisFadeIn delay={0.04}>
        <GenesisHero />
      </GenesisFadeIn>
      <GenesisFadeIn delay={0.06}>
        <GenesisStats supply={supply} />
      </GenesisFadeIn>
      <GenesisFadeIn delay={0.08}>
        <GenesisProgress supply={supply} />
      </GenesisFadeIn>
      <GenesisFadeIn delay={0.1}>
        <GenesisFeaturedNft />
      </GenesisFadeIn>
      <GenesisFadeIn delay={0.12}>
        <GenesisDetails />
      </GenesisFadeIn>
      <GenesisFadeIn delay={0.14}>
        <GenesisContract />
      </GenesisFadeIn>
      <GenesisFadeIn delay={0.16}>
        <GenesisBenefits />
      </GenesisFadeIn>
      <GenesisFadeIn delay={0.18}>
        <GenesisAbout />
      </GenesisFadeIn>
      <GenesisFadeIn delay={0.2}>
        <GenesisRoadmap />
      </GenesisFadeIn>
    </PageShell>
  );
}
