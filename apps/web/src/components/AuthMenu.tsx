import { auth, signIn, signOut } from "@/auth";
import { dicts, type Locale } from "@/lib/i18n";

/**
 * Sign in / sign out control rendered inside NavBar. Kept as a server
 * component so the auth() call lives on the server — the client navbar just
 * slots this in via the `authMenu` prop.
 */
export async function AuthMenu({ locale }: { locale: Locale }) {
  const session = await auth();
  const t = dicts[locale].nav;
  if (session?.user) {
    return (
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          title={session.user.email ?? undefined}
          className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-neutral-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          {t.signOut}
        </button>
      </form>
    );
  }
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: "/library" });
      }}
    >
      <button
        type="submit"
        className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-neutral-200"
      >
        {t.signIn}
      </button>
    </form>
  );
}
