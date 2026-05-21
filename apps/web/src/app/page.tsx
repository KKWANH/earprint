import { redirect } from "next/navigation";

/** The library dashboard is the home screen. */
export default function HomePage() {
  redirect("/library");
}
