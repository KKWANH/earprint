/** Shared layout for the privacy policy and terms pages. */
export interface LegalSection {
  heading: string;
  body: string[];
}

export function LegalDoc({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-xs text-neutral-500">{updated}</p>
      </div>
      {sections.map((s, i) => (
        <section key={i} className="flex flex-col gap-2">
          <h2 className="font-semibold">{`${i + 1}. ${s.heading}`}</h2>
          {s.body.map((p, j) => (
            <p key={j} className="text-sm leading-relaxed text-neutral-300">
              {p}
            </p>
          ))}
        </section>
      ))}
    </main>
  );
}
