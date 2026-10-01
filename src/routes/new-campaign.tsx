import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check } from "lucide-react";
import { AppShell, Btn, Card, ErrorBanner } from "@/components/lily/AppShell";
import { getCampaigns, unwrap, updateCampaign } from "@/lib/api";
import { PRESETS } from "@/lib/sequence";
import { useCurrentUser, useTeam } from "@/lib/current-user";

export const Route = createFileRoute("/new-campaign")({
  head: () => ({ meta: [{ title: "New campaign · Lily" }] }),
  component: NewCampaign,
});

function NewCampaign() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["id"]>("invite_only");
  const { user } = useCurrentUser();
  const { members } = useTeam();
  // null = follow whoever is using Lily; a string = picked explicitly ("" = unassigned).
  const [ownerPick, setOwnerPick] = useState<string | null>(null);
  const owner = ownerPick ?? user?.key ?? "";
  const campaigns = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => unwrap(getCampaigns()),
    staleTime: 60_000,
  });
  const taken = (campaigns.data?.campaigns ?? []).some(
    (c) => c.name.toLowerCase() === name.trim().toLowerCase(),
  );

  const create = useMutation({
    mutationFn: () =>
      unwrap(
        updateCampaign({
          data: {
            name: name.trim(),
            create: true,
            status: "draft",
            owner,
            sequence: PRESETS.find((p) => p.id === preset)!.build(),
          },
        }),
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["campaigns"] });
      navigate({ to: "/campaigns/$name", params: { name: name.trim() } });
    },
  });

  const valid =
    name.trim().length > 0 && name.trim().length <= 120 && !taken && name.trim() !== "Legacy queue";

  return (
    <AppShell
      title="New campaign"
      subtitle="Name it, pick a starting sequence, then add leads and launch."
    >
      <Card className="mx-auto max-w-3xl p-6">
        <label
          htmlFor="name"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Campaign name
        </label>
        <input
          id="name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          placeholder="e.g. AI product leaders, October"
          className="mt-2 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/30"
        />
        {taken && (
          <p className="mt-2 text-xs text-destructive">A campaign with this name already exists.</p>
        )}

        {members.length > 0 && (
          <>
            <label
              htmlFor="owner"
              className="mt-6 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Owner
            </label>
            <select
              id="owner"
              value={owner}
              onChange={(e) => setOwnerPick(e.target.value)}
              className="mt-2 w-full rounded-lg border bg-card px-3 py-2.5 text-sm sm:w-80"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.name}
                  {m.role ? `, ${m.role}` : ""}
                </option>
              ))}
            </select>
          </>
        )}

        <div className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sequence
        </div>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              className={`rounded-2xl border p-4 text-left transition ${preset === p.id ? "border-primary bg-primary-soft ring-1 ring-primary" : "hover:border-primary/50"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink">{p.label}</span>
                {preset === p.id && <Check className="h-4 w-4 text-primary" />}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{p.description}</div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          You can change the sequence and write the messages on the next screen.
        </p>

        <div className="mt-6 flex justify-end">
          <Btn onClick={() => create.mutate()} disabled={!valid || create.isPending}>
            {create.isPending ? "Creating" : "Create and add leads"}{" "}
            <ArrowRight className="h-4 w-4" />
          </Btn>
        </div>
        {create.error && (
          <div className="mt-4">
            <ErrorBanner error={create.error} />
          </div>
        )}
      </Card>
    </AppShell>
  );
}
