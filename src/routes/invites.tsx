import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, RefreshCw, X } from "lucide-react";
import {
  AppShell,
  Card,
  Btn,
  Avatar,
  ErrorBanner,
  Loading,
  EmptyState,
  initialsOf,
  timeAgo,
} from "@/components/lily/AppShell";
import { getInvites, respondToInvite, withdrawInvite, unwrap } from "@/lib/api";
import type { Invitation } from "@/lib/types";
import { BulkWithdrawCard } from "@/components/lily/BulkWithdrawCard";
import { AccountPicker, useAccountChoice } from "@/components/lily/AccountPicker";

export const Route = createFileRoute("/invites")({
  head: () => ({
    meta: [
      { title: "Invites · Lily" },
      {
        name: "description",
        content: "Accept or ignore incoming LinkedIn invites and withdraw stale outgoing ones.",
      },
    ],
  }),
  component: Invites,
});

type Outcome = "accepted" | "ignored" | "withdrawn";

function Invites() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"incoming" | "outgoing">("incoming");
  const [done, setDone] = useState<Record<string, Outcome>>({});
  const choice = useAccountChoice();
  const account = choice.account;
  const acc = account ? { account } : {};
  const invites = useQuery({
    queryKey: ["invites", account],
    queryFn: () => unwrap(getInvites({ data: acc })),
    enabled: choice.loaded,
    staleTime: 60_000,
  });

  const respond = useMutation({
    mutationFn: (v: { inv: Invitation; action: "accept" | "decline" }) =>
      unwrap(
        respondToInvite({
          data: {
            id: v.inv.id,
            action: v.action,
            shared_secret: v.inv.shared_secret ?? "",
            ...acc,
          },
        }),
      ),
    onSuccess: (_r, v) =>
      setDone((d) => ({ ...d, [v.inv.id]: v.action === "accept" ? "accepted" : "ignored" })),
  });
  const withdraw = useMutation({
    mutationFn: (inv: Invitation) => unwrap(withdrawInvite({ data: { id: inv.id, ...acc } })),
    onSuccess: (_r, inv) => setDone((d) => ({ ...d, [inv.id]: "withdrawn" })),
  });

  const incoming = invites.data?.incoming ?? [];
  const outgoing = invites.data?.outgoing ?? [];
  const list = tab === "incoming" ? incoming : outgoing;
  const actionError = respond.error ?? withdraw.error;

  return (
    <AppShell
      title="Invites"
      subtitle={`People who want to connect with ${choice.member ? choice.member.name.split(" ")[0] : "you"}, and invites sent from this LinkedIn that are still pending.`}
      actions={
        <>
          <AccountPicker
            member={choice.member}
            options={choice.options}
            onChange={(k) => {
              setDone({});
              choice.setMember(k);
            }}
          />
          <Btn
            variant="outline"
            onClick={() => {
              setDone({});
              qc.invalidateQueries({ queryKey: ["invites"] });
            }}
            disabled={invites.isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${invites.isFetching ? "animate-spin" : ""}`} /> Refresh
          </Btn>
        </>
      }
    >
      <div className="mb-4 inline-flex rounded-xl border bg-card p-1">
        {(["incoming", "outgoing"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {t}{" "}
            <span className="opacity-70">{(t === "incoming" ? incoming : outgoing).length}</span>
          </button>
        ))}
      </div>

      {tab === "outgoing" && (
        <BulkWithdrawCard account={account} accountLabel={choice.member?.name ?? null} />
      )}

      {invites.error && (
        <div className="mb-4">
          <ErrorBanner error={invites.error} />
        </div>
      )}
      {actionError && (
        <div className="mb-4">
          <ErrorBanner error={actionError} />
        </div>
      )}

      {invites.isPending ? (
        <Card>
          <Loading label="Loading invitations from LinkedIn" />
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            title={tab === "incoming" ? "No pending invitations" : "No pending sent invites"}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {list.map((i) => {
            const outcome = done[i.id];
            const busy =
              (respond.isPending && respond.variables?.inv.id === i.id) ||
              (withdraw.isPending && withdraw.variables?.id === i.id);
            return (
              <Card
                key={i.id}
                className={`flex items-center gap-4 p-4 transition ${outcome ? "opacity-60" : ""}`}
              >
                <Avatar initials={initialsOf(i.person.name)} src={i.person.picture_url} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{i.person.name}</span>
                    {i.at && (
                      <span className="text-xs text-muted-foreground">· {timeAgo(i.at)} ago</span>
                    )}
                    {i.person.profile_url && (
                      <a
                        href={i.person.profile_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground hover:text-primary"
                        aria-label="Open LinkedIn profile"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                  {i.person.headline && (
                    <div className="truncate text-sm text-muted-foreground">
                      {i.person.headline}
                    </div>
                  )}
                  {i.note && (
                    <div className="mt-2 rounded-lg bg-muted px-3 py-2 text-sm italic">
                      "{i.note}"
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  {outcome ? (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${outcome === "accepted" ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"}`}
                    >
                      {outcome}
                    </span>
                  ) : tab === "incoming" ? (
                    <>
                      <Btn
                        variant="danger"
                        disabled={busy || !i.shared_secret}
                        onClick={() => respond.mutate({ inv: i, action: "decline" })}
                      >
                        <X className="h-4 w-4" /> Ignore
                      </Btn>
                      <Btn
                        variant="success"
                        disabled={busy || !i.shared_secret}
                        onClick={() => respond.mutate({ inv: i, action: "accept" })}
                      >
                        <Check className="h-4 w-4" /> Accept
                      </Btn>
                    </>
                  ) : (
                    <Btn
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        window.confirm(`Withdraw the invite to ${i.person.name}?`) &&
                        withdraw.mutate(i)
                      }
                    >
                      Withdraw
                    </Btn>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
