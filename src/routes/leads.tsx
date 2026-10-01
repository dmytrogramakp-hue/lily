import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { CheckCircle2, FileSpreadsheet, Play, Upload, X } from "lucide-react";
import { AppShell, Card, Btn, ErrorBanner } from "@/components/lily/AppShell";
import { getCampaigns, setCampaignStatus, uploadLeads, unwrap } from "@/lib/api";
import type { LeadInput, UploadResult } from "@/lib/types";

export const Route = createFileRoute("/leads")({
  head: () => ({
    meta: [
      { title: "Upload leads · Lily" },
      {
        name: "description",
        content: "Upload a CSV of LinkedIn profiles as a new outreach campaign.",
      },
    ],
  }),
  component: Leads,
});

type Field = "linkedin_url" | "first_name" | "last_name" | "full_name" | "company" | "title";

const FIELDS: { key: Field; label: string; required?: boolean; aliases: string[] }[] = [
  {
    key: "linkedin_url",
    label: "LinkedIn URL",
    required: true,
    aliases: [
      "linkedin_url",
      "linkedin url",
      "person linkedin url",
      "linkedin profile",
      "linkedin profile url",
      "profile url",
      "profile_url",
      "linkedin",
      "li url",
      "url",
    ],
  },
  {
    key: "first_name",
    label: "First name",
    aliases: ["first_name", "first name", "firstname", "given name"],
  },
  {
    key: "last_name",
    label: "Last name",
    aliases: ["last_name", "last name", "lastname", "surname", "family name"],
  },
  {
    key: "full_name",
    label: "Full name (if no first/last)",
    aliases: ["full name", "full_name", "name", "contact name", "person name"],
  },
  {
    key: "company",
    label: "Company",
    aliases: [
      "company",
      "company name",
      "company_name",
      "organization",
      "organisation",
      "account name",
      "current company",
    ],
  },
  {
    key: "title",
    label: "Job title",
    aliases: ["title", "job title", "job_title", "position", "current title", "headline"],
  },
];

const MAX_ROWS = 5000;
const norm = (s: string) => s.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
const linkedinId = (u: string) => {
  const m = String(u || "")
    .trim()
    .toLowerCase()
    .match(/linkedin\.com\/(?:in|pub)\/([^/?#\s]+)/);
  return m?.[1] ? m[1].replace(/\/$/, "") : "";
};

function guessMapping(headers: string[]): Record<Field, string> {
  const map = {} as Record<Field, string>;
  const byNorm = new Map(headers.map((h) => [norm(h), h]));
  for (const f of FIELDS) {
    const hit = f.aliases.map((a) => byNorm.get(norm(a))).find(Boolean);
    map[f.key] = hit ?? "";
  }
  if (!map.linkedin_url) {
    const fuzzy = headers.find((h) => /linkedin/i.test(h));
    if (fuzzy) map.linkedin_url = fuzzy;
  }
  return map;
}

function Leads() {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<Field, string>>({} as Record<Field, string>);
  const [campaign, setCampaign] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  const campaigns = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => unwrap(getCampaigns()),
    staleTime: 60_000,
  });
  const existing = (campaigns.data?.campaigns ?? [])
    .filter((c) => c.status !== "legacy")
    .map((c) => c.name);

  const upload = useMutation({
    mutationFn: (payload: { campaign_name: string; source_file: string; leads: LeadInput[] }) =>
      unwrap(uploadLeads({ data: payload })),
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
  const activate = useMutation({
    mutationFn: (name: string) => unwrap(setCampaignStatus({ data: { name, status: "active" } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const reset = () => {
    setFileName("");
    setHeaders([]);
    setRows([]);
    setResult(null);
    setParseError(null);
    upload.reset();
    activate.reset();
    if (fileInput.current) fileInput.current.value = "";
  };

  const handleFile = (file: File) => {
    reset();
    if (!/\.csv$/i.test(file.name)) {
      setParseError(
        "Please upload a .csv file. Export from Sales Navigator, Apollo or Google Sheets as CSV.",
      );
      return;
    }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const fields = (res.meta.fields ?? []).filter(Boolean);
        if (!fields.length || !res.data.length) {
          setParseError("The file has no rows. Check that the first line is a header row.");
          return;
        }
        setFileName(file.name);
        setHeaders(fields);
        setRows(res.data);
        setMapping(guessMapping(fields));
        setCampaign(
          (c) =>
            c ||
            file.name
              .replace(/\.csv$/i, "")
              .replace(/[_-]+/g, " ")
              .trim()
              .slice(0, 80),
        );
      },
      error: (err) => setParseError(`Could not read the file: ${err.message}`),
    });
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const leads: LeadInput[] = useMemo(() => {
    if (!mapping.linkedin_url) return [];
    return rows.slice(0, MAX_ROWS).map((r) => {
      let first = mapping.first_name ? (r[mapping.first_name] ?? "") : "";
      let last = mapping.last_name ? (r[mapping.last_name] ?? "") : "";
      if (!first && !last && mapping.full_name) {
        const parts = String(r[mapping.full_name] ?? "")
          .trim()
          .split(/\s+/);
        first = parts.shift() ?? "";
        last = parts.join(" ");
      }
      return {
        linkedin_url: String(r[mapping.linkedin_url] ?? "").trim(),
        first_name: String(first).trim(),
        last_name: String(last).trim(),
        company: mapping.company ? String(r[mapping.company] ?? "").trim() : "",
        title: mapping.title ? String(r[mapping.title] ?? "").trim() : "",
      };
    });
  }, [rows, mapping]);

  const stats = useMemo(() => {
    const seen = new Set<string>();
    let valid = 0,
      invalid = 0,
      dupes = 0;
    for (const l of leads) {
      const id = linkedinId(l.linkedin_url);
      if (!id) invalid++;
      else if (seen.has(id)) dupes++;
      else {
        seen.add(id);
        valid++;
      }
    }
    return { valid, invalid, dupes };
  }, [leads]);

  const canUpload =
    !!mapping.linkedin_url && stats.valid > 0 && campaign.trim().length > 0 && !upload.isPending;

  const submit = () => {
    if (!canUpload) return;
    upload.mutate({
      campaign_name: campaign.trim(),
      source_file: fileName,
      leads: leads.filter((l) => linkedinId(l.linkedin_url)),
    });
  };

  return (
    <AppShell
      title="Upload leads"
      subtitle="Drop a CSV of LinkedIn profiles. Lily dedupes it against everyone already in the queue."
    >
      {result ? (
        <Card className="mx-auto max-w-2xl p-8 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
          <h2 className="mt-3 text-xl font-bold text-ink">
            {result.added.toLocaleString()} leads added to "{result.campaign_name}"
          </h2>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl bg-success-soft p-3">
              <div className="text-2xl font-bold text-success">{result.added}</div>added
            </div>
            <div className="rounded-xl bg-muted p-3">
              <div className="text-2xl font-bold text-ink">{result.duplicates}</div>already in queue
            </div>
            <div className="rounded-xl bg-muted p-3">
              <div className="text-2xl font-bold text-ink">{result.invalid}</div>invalid URLs
            </div>
          </div>
          {result.added > 0 && (
            <div className="mt-6 rounded-xl border bg-primary-soft/50 p-4 text-left text-sm">
              <div className="font-semibold text-ink">The campaign is paused.</div>
              <div className="mt-1 text-muted-foreground">
                Nothing is sent until you activate it. Once active, invites go out at about 20 per
                weekday, then the two follow-up messages run automatically.
              </div>
              {activate.isSuccess ? (
                <div className="mt-3 inline-flex items-center gap-2 font-semibold text-success">
                  <CheckCircle2 className="h-4 w-4" /> Campaign activated
                </div>
              ) : (
                <Btn
                  className="mt-3"
                  onClick={() =>
                    window.confirm(
                      `Activate "${result.campaign_name}" and start sending invites?`,
                    ) && activate.mutate(result.campaign_name)
                  }
                  disabled={activate.isPending}
                >
                  <Play className="h-4 w-4" /> Activate campaign
                </Btn>
              )}
              {activate.error && (
                <div className="mt-3">
                  <ErrorBanner error={activate.error} />
                </div>
              )}
            </div>
          )}
          <div className="mt-6 flex justify-center gap-2">
            <Btn variant="outline" onClick={reset}>
              Upload another list
            </Btn>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg border bg-card px-3.5 py-2 text-sm font-semibold hover:bg-muted"
            >
              Go to campaigns
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            {!rows.length ? (
              <Card
                className={`flex cursor-pointer flex-col items-center justify-center border-2 border-dashed px-6 py-16 text-center transition ${dragging ? "border-primary bg-primary-soft" : "hover:border-primary/60"}`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInput.current?.click()}
                  onKeyDown={(e) =>
                    (e.key === "Enter" || e.key === " ") && fileInput.current?.click()
                  }
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className="flex w-full flex-col items-center"
                >
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div className="mt-4 text-lg font-semibold text-ink">
                    Drop your CSV here, or click to choose
                  </div>
                  <div className="mt-1 max-w-md text-sm text-muted-foreground">
                    One row per person. Lily needs a LinkedIn profile URL column. First name, last
                    name, company and title are used when present.
                  </div>
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <div className="flex items-center gap-3 border-b px-5 py-3">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-ink">{fileName}</div>
                    <div className="text-xs text-muted-foreground">
                      {rows.length.toLocaleString()} rows · {headers.length} columns
                    </div>
                  </div>
                  <button
                    onClick={reset}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2">Name</th>
                        <th className="px-3 py-2">Title</th>
                        <th className="px-3 py-2">Company</th>
                        <th className="px-3 py-2">LinkedIn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.slice(0, 8).map((l, i) => {
                        const ok = !!linkedinId(l.linkedin_url);
                        return (
                          <tr key={i} className="border-t">
                            <td className="px-4 py-2 font-medium">
                              {[l.first_name, l.last_name].filter(Boolean).join(" ") || (
                                <span className="text-muted-foreground">–</span>
                              )}
                            </td>
                            <td className="max-w-[220px] truncate px-3 py-2 text-muted-foreground">
                              {l.title || "–"}
                            </td>
                            <td className="px-3 py-2">{l.company || "–"}</td>
                            <td
                              className={`max-w-[240px] truncate px-3 py-2 font-mono text-xs ${ok ? "text-primary" : "text-destructive"}`}
                            >
                              {l.linkedin_url || "missing"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {rows.length > 8 && (
                  <div className="border-t px-4 py-2 text-xs text-muted-foreground">
                    Showing 8 of {rows.length.toLocaleString()} rows
                  </div>
                )}
              </Card>
            )}
            {parseError && <ErrorBanner error={parseError} />}
            {rows.length > MAX_ROWS && (
              <ErrorBanner
                error={`Only the first ${MAX_ROWS.toLocaleString()} rows will be uploaded. Split larger files into several campaigns.`}
              />
            )}
          </div>

          <div className="space-y-6">
            <Card className="p-5">
              <label
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                htmlFor="campaign"
              >
                Campaign name
              </label>
              <input
                id="campaign"
                list="campaign-names"
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
                placeholder="e.g. Fintech compliance leads, October"
                maxLength={120}
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
              />
              <datalist id="campaign-names">
                {existing.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              <p className="mt-2 text-xs text-muted-foreground">
                Use an existing name to add these leads to that campaign.
              </p>
            </Card>

            {rows.length > 0 && (
              <Card className="p-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Column mapping
                </div>
                <div className="mt-3 space-y-3">
                  {FIELDS.map((f) => (
                    <div key={f.key}>
                      <label className="text-xs font-semibold" htmlFor={`map-${f.key}`}>
                        {f.label}
                        {f.required && <span className="text-destructive"> *</span>}
                      </label>
                      <select
                        id={`map-${f.key}`}
                        value={mapping[f.key] ?? ""}
                        onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                        className="mt-1 w-full rounded-lg border bg-card px-2 py-1.5 text-sm"
                      >
                        <option value="">Not in file</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {rows.length > 0 && (
              <Card className="p-5">
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div>
                    <div className="text-xl font-bold text-ink">{stats.valid.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">ready</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-ink">{stats.dupes.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">dupes in file</div>
                  </div>
                  <div>
                    <div
                      className={`text-xl font-bold ${stats.invalid ? "text-destructive" : "text-ink"}`}
                    >
                      {stats.invalid.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">no valid URL</div>
                  </div>
                </div>
                <Btn className="mt-4 w-full justify-center" onClick={submit} disabled={!canUpload}>
                  <Upload className="h-4 w-4" />{" "}
                  {upload.isPending ? "Uploading" : `Add ${stats.valid.toLocaleString()} leads`}
                </Btn>
                {!mapping.linkedin_url && (
                  <p className="mt-2 text-xs text-destructive">
                    Pick the column that holds LinkedIn profile URLs.
                  </p>
                )}
                {!campaign.trim() && (
                  <p className="mt-2 text-xs text-destructive">Give the campaign a name.</p>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  The campaign is created paused. Nothing is sent until you activate it.
                </p>
              </Card>
            )}
            {upload.error && <ErrorBanner error={upload.error} />}
          </div>
        </div>
      )}
    </AppShell>
  );
}
