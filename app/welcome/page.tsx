export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-sm space-y-6 py-16 text-center">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-wide">
          WHO&apos;S DRAFTING?
        </h1>
        <p className="mt-2 text-sm text-mute">
          Type your name to get your own rankings, tiers, and draft history.
        </p>
      </div>
      <form action="/api/identity" method="POST" className="space-y-3">
        <input
          type="text"
          name="name"
          placeholder="Your name"
          autoFocus
          required
          className="w-full rounded-lg border border-line bg-panel px-4 py-2.5 text-center text-lg placeholder:text-mute focus:border-accent/60 focus:outline-none"
        />
        {error && <p className="text-sm text-down">Enter a name to continue.</p>}
        <button
          type="submit"
          className="w-full rounded-lg bg-gradient-to-r from-accent to-accent2 py-2.5 font-display text-lg font-bold uppercase tracking-widest text-ink transition-all hover:brightness-110"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
