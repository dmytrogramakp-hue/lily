import { useMemo, useRef, useState, type DragEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { CheckCircle2, FileSpreadsheet, Upload, X } from "lucide-react";
import { Btn, Card, ErrorBanner } from "@/components/lily/AppShell";
import { unwrap, uploadLeads } from "@/lib/api";
import type { LeadInput, UploadResult } from "@/lib/types";

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
export const linkedinId = (u: string) => {
  const m = String(u || "")
    .trim()
    .toLowerCase()
    .match(/linkedin\.com\/(?:in|pub)\/([^/?#\s]+)/);
  return m?.[1] ? m[1].replace(/\/$/, "") : "";
};

function guessMapping(headers: string[]): Record<Field, string> {
  const map = {} as Record<Field, string>;
  const byNorm = new Map(headers.map((h) => [norm(h), h]));
  for (const f of FIELDS)
    map[f.key] = f.aliases.map((a) => byNorm.get(norm(a))).find(Boolean) ?? "";
  if (!map.linkedin_url) map.linkedin_url = headers.find((h) => /linkedin/i.test(h)) ?? "";
  return map;
}

/**
 * CSV upload with column mapping, preview and in-file dedupe.
 * With `campaign` set, leads always go to that campaign and the name field is hidden.
 */
export function LeadUploader({
  campaign,
  onUploaded,
}: {
  campaign: string;
  onUploaded?: (r: UploadResult) => void;
}) {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<Field, string>>({} as Record<Field, string>);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  const upload = useMutation({
    mutationFn: (payload: { campaign_name: string; source_file: string; leads: LeadInput[] }) =>
      unwrap(uploadLeads({ data: payload })),
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["campaign-leads", campaign] });
      onUploaded?.(r);
    },
  });

  const reset = () => {
    setFileName("");
    setHeaders([]);
    setRows([]);
    setResult(null);
    setParseError(null);
    upload.reset();
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
    let valid = 0;
    let invalid = 0;
    let dupes = 0;
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

  const canUpload = !!mapping.linkedin_url && stats.valid > 0 && !upload.isPending;
  const submit = () => {
    if (!canUpload) return;
    upload.mutate({
      campaign_name: campaign,
      source_file: fileName,
      leads: leads.filter((l) => linkedinId(l.linkedin_url)),
    });
  };

  if (result) {
    return (
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-success" />
          <div className="flex-1">
            <div className="font-semibold text-ink">
              {result.added.toLocaleString()} leads added
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {result.duplicates.toLocaleString()} were already in the queue and{" "}
              {result.invalid.toLocaleString()} had no valid LinkedIn URL, so they were skipped.
            </div>
          </div>
          <Btn variant="outline" onClick={reset}>
            Upload another file
          </Btn>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        {!rows.length ? (
          <Card
            className={`border-2 border-dashed px-6 py-12 text-center transition ${dragging ? "border-primary bg-primary-soft" : "hover:border-primary/60"}`}
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInput.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className="flex cursor-pointer flex-col items-center"
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary">
                <Upload className="h-5 w-5" />
              </div>
              <div className="mt-3 font-semibold text-ink">Drop a CSV here, or click to choose</div>
              <div className="mt-1 max-w-md text-sm text-muted-foreground">
                One row per person with a LinkedIn profile URL. First name, last name, company and
                title are used for personalisation when present.
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
                          {[l.first_name, l.last_name].filter(Boolean).join(" ") || "–"}
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
            error={`Only the first ${MAX_ROWS.toLocaleString()} rows will be uploaded. Split larger files.`}
          />
        )}
        {upload.error && <ErrorBanner error={upload.error} />}
      </div>

      {rows.length > 0 && (
        <div className="space-y-4">
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
            <p className="mt-3 text-xs text-muted-foreground">
              Anyone already in your queue from any campaign is skipped automatically.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
