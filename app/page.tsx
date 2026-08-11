import type { Metadata } from "next";
import currentData from "@/public/data/current.json";
import { TurkeySciDashboard } from "./TurkeySciDashboard";

export const metadata: Metadata = {
  title: "TurkeySci | Kīlauea eruption timing model",
  description:
    "An automatically updated Bayesian view of Kīlauea's next lava-fountaining episode, based on official USGS forecast windows.",
};

export default function Home() {
  return <TurkeySciDashboard initialData={currentData} />;
}
