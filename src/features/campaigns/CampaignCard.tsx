import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { List, Megaphone, Phone } from "lucide-react";
import { useToast } from "@/components/ui/useToast";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchNextQueueLead } from "@/api/crmApi";
import type { CrmMyLeadCampaign } from "@/api/crmApi";
import { cn } from "@/lib/utils";

// The three states an assigned lead can be in; together they add up to "assigned".
const SEGMENTS = [
  { key: "closed", label: "Closed", color: "var(--success)" },
  { key: "in_progress", label: "In progress", color: "var(--accent)" },
  { key: "uncontacted", label: "Not contacted", color: "var(--error)" },
] as const;

/**
 * A pipeline card, in the same language as the lead cards (LeadCard):
 * name + how much is worked → one stacked bar of where the assigned leads stand → full-width action bar.
 */
export function CampaignCard({ campaign }: { campaign: CrmMyLeadCampaign }) {
  const navigate = useNavigate();
  const { show } = useToast();
  const userId = useAuthStore((s) => s.user?.id ?? "");
  const [starting, setStarting] = useState(false);

  const contacted = Math.max(campaign.assigned - campaign.uncontacted, 0);
  const worked =
    campaign.assigned > 0
      ? Math.round((contacted / campaign.assigned) * 100)
      : 0;
  const createdOn = campaign.created_at
    ? format(new Date(campaign.created_at), "dd/MM/yyyy")
    : "—";
  const counts = {
    closed: campaign.closed,
    in_progress: campaign.in_progress,
    uncontacted: campaign.uncontacted,
  };
  const barTotal = counts.closed + counts.in_progress + counts.uncontacted;

  async function startCalling() {
    setStarting(true);
    try {
      const lead = await fetchNextQueueLead(campaign.id, userId);
      if (!lead) {
        show({ title: "No leads to call in this pipeline", tone: "error" });
        return;
      }
      navigate(`/campaigns/${campaign.id}/call/${lead.id}`);
    } catch (err) {
      show({
        title: err instanceof Error ? err.message : "Failed to start calling",
        tone: "error",
      });
    } finally {
      setStarting(false);
    }
  }

  const barBtn =
    "flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60";

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-[var(--border)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-12px_rgba(0,0,0,0.18)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      {/* Header band: a soft orange wash carries the name, so each pipeline reads as one block. */}
      <div className="flex items-center gap-3 bg-gradient-to-br from-[var(--accent-bg)] to-transparent px-4 pb-3 pt-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--accent-strong)] shadow-[var(--shadow-sm)]">
          <Megaphone size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight tracking-[-0.01em] text-[var(--text-h)]">
            {campaign.name}
          </p>
          <p className="mt-1 font-mono-num text-[12px] text-[var(--text-muted)]">
            {campaign.lead_count} {campaign.lead_count === 1 ? "lead" : "leads"}{" "}
            · {createdOn}
          </p>
        </div>
        {campaign.unassigned > 0 && (
          <span className="shrink-0 rounded-full border border-dashed border-[var(--warning)] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--warning)]">
            {campaign.unassigned} unassigned
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 px-4 pb-4 pt-2">
        {/* Progress: the big number, then a thick stacked bar of where the assigned leads stand. */}
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-2">
            <span className="font-mono-num text-[28px] font-semibold leading-none tracking-[-0.02em] text-[var(--text-h)]">
              {worked}%
            </span>
            <span className="text-[12px] text-[var(--text-muted)]">
              contacted ·{" "}
              <span className="font-mono-num font-medium text-[var(--text-h)]">
                {contacted}
              </span>{" "}
              of{" "}
              <span className="font-mono-num font-medium text-[var(--text-h)]">
                {campaign.assigned}
              </span>{" "}
              assigned
            </span>
          </div>
          <div
            className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-[var(--surface-hover)]"
            role="img"
            aria-label={SEGMENTS.map((s) => `${s.label} ${counts[s.key]}`).join(
              ", ",
            )}
          >
            {barTotal > 0 &&
              SEGMENTS.map((s) =>
                counts[s.key] > 0 ? (
                  <span
                    key={s.key}
                    className="h-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
                    style={{
                      width: `${(counts[s.key] / barTotal) * 100}%`,
                      background: s.color,
                    }}
                  />
                ) : null,
              )}
          </div>
        </div>

        {/* The three counts as tiles: number big, in its segment's colour; label underneath. */}
        <div className="grid grid-cols-3 gap-2">
          {SEGMENTS.map((s) => (
            <div
              key={s.key}
              className="flex min-w-0 flex-col gap-0.5 rounded-xl px-3 py-2.5"
              style={{
                background:
                  counts[s.key] > 0
                    ? `color-mix(in srgb, ${s.color} 10%, transparent)`
                    : "var(--surface-hover)",
              }}
            >
              <span
                className="font-mono-num text-[18px] font-semibold leading-tight"
                style={{
                  color:
                    counts[s.key] > 0
                      ? `color-mix(in srgb, ${s.color} 80%, var(--text-h))`
                      : "var(--text-muted)",
                }}
              >
                {counts[s.key]}
              </span>
              <span className="truncate text-[11px] font-medium text-[var(--text-muted)]">
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Action bar pinned to the bottom so every card's buttons line up. */}
        <div className="mt-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/campaigns/${campaign.id}/leads`)}
            className={cn(
              barBtn,
              "bg-[var(--surface-hover)] text-[var(--text-h)] hover:bg-[var(--border)] focus-visible:outline-[var(--accent)]",
            )}
          >
            <List size={15} /> View leads
          </button>
          <button
            type="button"
            onClick={startCalling}
            disabled={starting}
            className={cn(
              barBtn,
              "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] focus-visible:outline-[var(--accent)]",
            )}
          >
            <Phone size={15} /> {starting ? "Connecting…" : "Start calling"}
          </button>
        </div>
      </div>
    </div>
  );
}
