import type { ReactElement } from "react";
import { AccessModel } from "@/components/sections/access-model";
import { Ask } from "@/components/sections/ask";
import { Closing } from "@/components/sections/closing";
import { Demo } from "@/components/sections/demo";
import { Features } from "@/components/sections/features";
import { Hero } from "@/components/sections/hero";
import { Pains } from "@/components/sections/pains";
import { Pricing } from "@/components/sections/pricing";

export default function HomePage(): ReactElement {
  return (
    <>
      <Hero />
      <Demo />
      <Pains />
      <AccessModel />
      <Ask />
      <Features />
      <Pricing />
      <Closing />
    </>
  );
}
