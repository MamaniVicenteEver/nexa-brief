import { EngineOrbit } from "@/features/home/components/EngineOrbit";
import { Hero } from "@/features/home/components/Hero";
import { PlatformShowcase } from "@/features/home/components/PlatformShowcase";
import { PlayReel } from "@/features/home/components/PlayReel";
import { Reasons } from "@/features/home/components/Reasons";

export default function HomePage() {
  return (
    <>
      <Hero />
      <PlayReel />
      <EngineOrbit />
      {/* Penúltima sección — pedido explícito */}
      <PlatformShowcase />
      <Reasons />
    </>
  );
}
