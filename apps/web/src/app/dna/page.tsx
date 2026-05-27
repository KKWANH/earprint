import { redirect } from "next/navigation";

/**
 * /dna is no longer a separate page (May 2026). The Taste DNA
 * imprint + novelty sections now live inside /profile as one
 * unified "your music insights" surface — user feedback was
 * "취향 DNA랑 심리분석을 합치는건 어떨까? 분리되어야 할지 헷갈려",
 * and the answer is yes, one page reads as one product.
 *
 * Keeping this route as a redirect rather than a 404 so any
 * external links (the README, shared `/dna` URLs people may
 * have pasted into Discord / Twitter) keep working — the user
 * lands on /profile and sees the DNA sections below the AI
 * persona, no missed beat.
 */
export default function DnaPage() {
  redirect("/profile");
}
