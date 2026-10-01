import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { Btn, ErrorBanner } from "@/components/lily/AppShell";
import { deleteCampaign, unwrap } from "@/lib/api";
import type { Campaign } from "@/lib/types";

/**
 * Confirms a campaign delete by typing its name. Deleting stops sending, removes the leads that
 * were never invited, and keeps invited leads as history so nobody is invited twice.
 */
export function DeleteCampaignDialog({
  campaign: c,
  open,
  onClose,
  onDeleted,
}: {
  campaign: Campaign;
  open: boolean;
  onClose: () => void;
  onDeleted?: (result: { removed_leads: number; kept_invited_leads: number }) => void;
}) {
  const qc = useQueryClient();
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (open) setTyped("");
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open, onClose]);

  const del = useMutation({
    mutationFn: () => unwrap(deleteCampaign({ data: { name: c.name } })),
    onSuccess: async (r) => {
      qc.removeQueries({ queryKey: ["campaign-leads", c.name] });
      await qc.invalidateQueries({ queryKey: ["campaigns"] });
      onDeleted?.(r);
      onClose();
    },
  });

  if (!open) return null;
  const invited = c.invited;
  const removable = c.leads - c.invited;
  const matches = typed.trim() === c.name;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && !del.isPending && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-card"
      >
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-destructive-soft text-destructive">
            <Trash2 className="h-5 w-5" />
          </div>
          <div>
            <h2 id="delete-title" className="text-lg font-bold text-ink">
              Delete "{c.name}"?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">This cannot be undone.</p>
          </div>
        </div>
        <ul className="mt-4 space-y-1.5 text-sm text-ink">
          {c.status === "active" && <li>Sending stops right away.</li>}
          <li>
            {removable > 0
              ? `${removable.toLocaleString()} lead${removable === 1 ? "" : "s"} not yet invited ${removable === 1 ? "is" : "are"} removed from the queue, so you can upload ${removable === 1 ? "it" : "them"} into another campaign.`
              : "There are no uninvited leads to remove."}
          </li>
          {invited > 0 && (
            <li>
              {invited.toLocaleString()} invited lead{invited === 1 ? " stays" : "s stay"} in the
              queue as history, so nobody gets invited twice. Their follow-up messages stop.
            </li>
          )}
          <li>The sequence and settings of this campaign are deleted.</li>
        </ul>
        <label className="mt-5 block text-xs font-medium text-muted-foreground">
          Type the campaign name to confirm
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={c.name}
            className="mt-1.5 w-full rounded-lg border bg-card px-3 py-2 text-sm text-ink"
          />
        </label>
        {del.error && (
          <div className="mt-3">
            <ErrorBanner error={del.error} />
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="ghost" onClick={onClose} disabled={del.isPending}>
            Cancel
          </Btn>
          <button
            type="button"
            onClick={() => del.mutate()}
            disabled={!matches || del.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-destructive px-3.5 py-2 text-sm font-semibold text-destructive-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {del.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {del.isPending ? "Deleting" : "Delete campaign"}
          </button>
        </div>
      </div>
    </div>
  );
}
