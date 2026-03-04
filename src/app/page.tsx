"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownUp,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Filter,
  Plus,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { COMPANY_PRIORITIES, COMPANY_SOURCES, COMPANY_STATUSES } from "@/lib/constants";
import { Company, CompanyPriority, CompanySource, CompanyStatus } from "@/lib/types";

type CompanyForm = {
  name: string;
  website: string;
  industry: string;
  emails: string;
  phones: string;
  assignedTo: string;
  instagramHandle: string;
  instagramUrl: string;
  facebookUrl: string;
  linkedinUrl: string;
  xUrl: string;
  tiktokUrl: string;
  youtubeUrl: string;
  source: CompanySource;
  status: CompanyStatus;
  priority: CompanyPriority;
  tags: string;
  notes: string;
  nextFollowUpAt: string;
};

type MetaPayload = {
  companies: (Company & {
    primaryContact?: { fullName?: string; emails?: string[]; phones?: string[] } | null;
  })[];
  pipeline: { status: string; count: number }[];
  followUps: {
    overdue: Company[];
    dueToday: Company[];
  };
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const EMPTY_FORM: CompanyForm = {
  name: "",
  website: "",
  industry: "",
  emails: "",
  phones: "",
  assignedTo: "",
  instagramHandle: "",
  instagramUrl: "",
  facebookUrl: "",
  linkedinUrl: "",
  xUrl: "",
  tiktokUrl: "",
  youtubeUrl: "",
  source: "Website",
  status: "New",
  priority: "Medium",
  tags: "",
  notes: "",
  nextFollowUpAt: "",
};

function parseCsvList(value: string) {
  return value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function statusTone(status: string) {
  if (status === "Won") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (status === "Lost") return "bg-rose-100 text-rose-700 border-rose-200";
  if (status === "Interested") return "bg-indigo-100 text-indigo-700 border-indigo-200";
  if (status === "Demo Sent") return "bg-amber-100 text-amber-700 border-amber-200";
  if (status === "Contacted") return "bg-cyan-100 text-cyan-700 border-cyan-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function priorityTone(priority: string) {
  if (priority === "High") return "bg-rose-100 text-rose-700 border-rose-200";
  if (priority === "Low") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  return "bg-amber-100 text-amber-700 border-amber-200";
}

export default function HomePage() {
  const [companies, setCompanies] = useState<MetaPayload["companies"]>([]);
  const [pipeline, setPipeline] = useState<{ status: string; count: number }[]>([]);
  const [followUps, setFollowUps] = useState<{ overdue: Company[]; dueToday: Company[] }>({ overdue: [], dueToday: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [form, setForm] = useState<CompanyForm>(EMPTY_FORM);

  async function loadDashboard(targetPage = page, targetPageSize = pageSize) {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ withMeta: "1" });
    params.set("page", String(targetPage));
    params.set("pageSize", String(targetPageSize));
    if (query) params.set("q", query);
    if (statusFilter) params.set("status", statusFilter);
    if (priorityFilter) params.set("priority", priorityFilter);

    try {
      const res = await fetch(`/api/companies?${params.toString()}`);
      if (!res.ok) {
        setLoading(false);
        const body = (await res.json().catch(() => ({}))) as { error?: string; details?: string };
        setError(body.error || body.details || "Failed to load companies");
        return;
      }

      const data = (await res.json()) as MetaPayload;
      setCompanies(data.companies || []);
      setPipeline(data.pipeline || []);
      setFollowUps(data.followUps || { overdue: [], dueToday: [] });
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setPage(data.page || targetPage);
      setPageSize(data.pageSize || targetPageSize);
      setLoading(false);
    } catch {
      setLoading(false);
      setError("CRM backend unavailable. Check Mongo connectivity.");
    }
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createCompany(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      ...form,
      tags: parseCsvList(form.tags),
      phones: parseCsvList(form.phones),
      emails: parseCsvList(form.emails),
      addresses: [],
      nextFollowUpAt: form.nextFollowUpAt ? new Date(form.nextFollowUpAt).toISOString() : null,
      lastTouchAt: null,
    };

    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      setError("Failed to create company");
      return;
    }

    setForm(EMPTY_FORM);
    await loadDashboard(1, pageSize);
  }

  async function deleteCompany(id: string, name: string) {
    if (!window.confirm(`Delete ${name}? This will permanently remove the company, all people, and all timeline activity.`)) {
      return;
    }

    const res = await fetch(`/api/companies/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Failed to delete company");
      return;
    }
    await loadDashboard(page, pageSize);
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/companies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setError("Failed to update status");
      return;
    }
    await loadDashboard(page, pageSize);
  }

  async function followUpAction(companyId: string, action: "done" | "snooze" | "reschedule") {
    const body: { companyId: string; action: string; until?: string | null } = {
      companyId,
      action,
    };
    if (action === "reschedule") {
      body.until = new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString();
    }

    const res = await fetch("/api/follow-ups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      setError("Failed follow-up action");
      return;
    }

    await loadDashboard(page, pageSize);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const openFollowUpCount = followUps.overdue.length + followUps.dueToday.length;
  const pipelineTotal = useMemo(() => pipeline.reduce((sum, p) => sum + p.count, 0), [pipeline]);

  return (
    <main className="mx-auto max-w-[1580px] space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="crm-surface flex flex-wrap items-center justify-between gap-4 p-5 md:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500">Wahlu CRM</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Company command center</h1>
          <p className="mt-1 text-sm text-slate-600">Find opportunities faster, keep every relationship warm, and close with confidence.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatPill icon={<Building2 size={15} />} label="Companies" value={total.toLocaleString()} />
          <StatPill icon={<CalendarClock size={15} />} label="Open follow-ups" value={String(openFollowUpCount)} />
          <button onClick={logout} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:shadow-sm">
            Log out
          </button>
        </div>
      </header>

      {error ? (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-3">
        <BucketCard title="Overdue" subtitle="Needs immediate action" icon={<Clock3 size={16} />} items={followUps.overdue} onAction={followUpAction} accent="rose" />
        <BucketCard title="Due today" subtitle="Plan your touches" icon={<CalendarClock size={16} />} items={followUps.dueToday} onAction={followUpAction} accent="amber" />
        <div className="crm-surface p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Pipeline distribution</h3>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">{pipelineTotal} total</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {pipeline.map((p) => (
              <div key={p.status} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 transition hover:border-indigo-200 hover:bg-indigo-50/40">
                <div className="text-xs text-slate-500">{p.status}</div>
                <div className="text-lg font-semibold text-slate-900">{p.count}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[430px_1fr]">
        <form onSubmit={createCompany} className="crm-surface space-y-3 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Add company</h2>
              <p className="text-xs text-slate-500">Capture the essentials first. You can enrich records later.</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700"><Plus size={14} /> New</span>
          </div>

          <Input label="Company name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} required />
          <div className="grid gap-2 md:grid-cols-2">
            <Input label="Website" value={form.website} onChange={(v) => setForm((f) => ({ ...f, website: v }))} />
            <Input label="Industry" value={form.industry} onChange={(v) => setForm((f) => ({ ...f, industry: v }))} />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <Input label="Emails" value={form.emails} onChange={(v) => setForm((f) => ({ ...f, emails: v }))} />
            <Input label="Phones" value={form.phones} onChange={(v) => setForm((f) => ({ ...f, phones: v }))} />
          </div>
          <Input label="Assigned to" value={form.assignedTo} onChange={(v) => setForm((f) => ({ ...f, assignedTo: v }))} />

          <div className="grid gap-2 md:grid-cols-3">
            <Select label="Source" value={form.source} options={COMPANY_SOURCES} onChange={(v) => setForm((f) => ({ ...f, source: v as CompanySource }))} />
            <Select label="Status" value={form.status} options={COMPANY_STATUSES} onChange={(v) => setForm((f) => ({ ...f, status: v as CompanyStatus }))} />
            <Select label="Priority" value={form.priority} options={COMPANY_PRIORITIES} onChange={(v) => setForm((f) => ({ ...f, priority: v as CompanyPriority }))} />
          </div>

          <Input label="Tags (comma-separated)" value={form.tags} onChange={(v) => setForm((f) => ({ ...f, tags: v }))} />
          <Input label="Next follow-up" type="datetime-local" value={form.nextFollowUpAt} onChange={(v) => setForm((f) => ({ ...f, nextFollowUpAt: v }))} />

          <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">Social links (optional)</summary>
            <div className="mt-2 space-y-2">
              <Input label="Instagram handle" value={form.instagramHandle} onChange={(v) => setForm((f) => ({ ...f, instagramHandle: v }))} />
              <Input label="Instagram URL" value={form.instagramUrl} onChange={(v) => setForm((f) => ({ ...f, instagramUrl: v }))} />
              <Input label="Facebook URL" value={form.facebookUrl} onChange={(v) => setForm((f) => ({ ...f, facebookUrl: v }))} />
              <Input label="LinkedIn URL" value={form.linkedinUrl} onChange={(v) => setForm((f) => ({ ...f, linkedinUrl: v }))} />
              <Input label="X URL" value={form.xUrl} onChange={(v) => setForm((f) => ({ ...f, xUrl: v }))} />
              <Input label="TikTok URL" value={form.tiktokUrl} onChange={(v) => setForm((f) => ({ ...f, tiktokUrl: v }))} />
              <Input label="YouTube URL" value={form.youtubeUrl} onChange={(v) => setForm((f) => ({ ...f, youtubeUrl: v }))} />
            </div>
          </details>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Notes</span>
            <textarea className="h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </label>

          <button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:opacity-60">
            {saving ? <CircleDashed size={15} className="animate-spin" /> : <Plus size={16} />} {saving ? "Saving company..." : "Create company"}
          </button>
        </form>

        <div className="crm-surface space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Company pipeline</h2>
              <p className="text-xs text-slate-500">Search, filter, update status, and move faster through your outreach.</p>
            </div>
            <button type="button" onClick={() => loadDashboard(page, pageSize)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50">Refresh</button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              loadDashboard(1, pageSize);
            }}
            className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]"
          >
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Search companies</span>
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  placeholder="Name, industry, email, phone, notes"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </label>
            <Select label="Status" value={statusFilter} options={["", ...COMPANY_STATUSES]} onChange={setStatusFilter} />
            <Select label="Priority" value={priorityFilter} options={["", ...COMPANY_PRIORITIES]} onChange={setPriorityFilter} />
            <div className="mt-auto flex gap-2">
              <button type="submit" className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"><Filter size={14} /> Apply</button>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("");
                  setPriorityFilter("");
                  setPage(1);
                  loadDashboard(1, pageSize);
                }}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Reset
              </button>
            </div>
          </form>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[0_16px_35px_-30px_rgba(15,23,42,0.65)]">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">Company list table</caption>
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-600">
                  <th className="sticky left-0 z-20 bg-slate-50/95 px-4 py-3">Company</th>
                  <th className="px-4 py-3">Primary contact</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Follow-up</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 7 }).map((_, i) => (
                    <tr key={`skel-${i}`} className="border-b border-slate-100">
                      <td colSpan={6} className="space-y-2 px-4 py-4">
                        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                        <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
                      </td>
                    </tr>
                  ))
                ) : companies.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10" colSpan={6}>
                      <div className="mx-auto max-w-md rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
                        <Building2 size={20} className="mx-auto text-slate-400" />
                        <p className="mt-2 text-sm font-medium text-slate-700">No companies match this view</p>
                        <p className="mt-1 text-xs text-slate-500">Try clearing filters or add a new company from the form.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setQuery("");
                            setStatusFilter("");
                            setPriorityFilter("");
                            setPage(1);
                            loadDashboard(1, pageSize);
                          }}
                          className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Clear filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  companies.map((company) => {
                    const primary = company.primaryContact;
                    const phone = primary?.phones?.[0] || company.phones?.[0] || "—";
                    return (
                      <tr key={company._id} className="group border-b border-slate-100 align-top transition hover:bg-indigo-50/30">
                        <td className="sticky left-0 z-10 bg-white px-4 py-3 group-hover:bg-indigo-50/30">
                          <div className="font-semibold text-slate-900">{company.name}</div>
                          <div className="mt-1 text-xs text-slate-500">{company.industry || "No industry"}</div>
                          {company.emails?.[0] ? <div className="text-xs text-slate-500">{company.emails[0]}</div> : null}
                        </td>
                        <td className="px-4 py-3">
                          <div className="inline-flex items-center gap-1 text-slate-800"><UserRound size={13} /> {primary?.fullName || "—"}</div>
                          <div className="text-xs text-slate-500">{primary?.emails?.[0] || phone}</div>
                        </td>
                        <td className="px-4 py-3">
                          <select className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" value={company.status} onChange={(e) => updateStatus(company._id, e.target.value)}>
                            {COMPANY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <div className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(company.status)}`}>{company.status}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${priorityTone(company.priority)}`}>{company.priority}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{company.nextFollowUpAt ? new Date(company.nextFollowUpAt).toLocaleDateString() : "Not set"}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Link href={`/companies/${company._id}`} className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 px-2.5 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-50">
                              <ArrowDownUp size={13} /> Open
                            </Link>
                            <button className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50" onClick={() => deleteCompany(company._id, company.name)}>
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 text-sm">
            <div className="text-slate-600">Page {page} / {totalPages} · {total.toLocaleString()} companies</div>
            <div className="flex items-center gap-2">
              <label className="text-slate-600">Page size</label>
              <select value={pageSize} onChange={(e) => { const nextSize = Number(e.target.value); setPageSize(nextSize); setPage(1); loadDashboard(1, nextSize); }} className="rounded-lg border border-slate-300 px-2 py-1.5">
                {[25, 50, 100, 200].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
              <button disabled={page <= 1 || loading} onClick={() => loadDashboard(page - 1, pageSize)} className="rounded-lg border border-slate-300 px-3 py-1.5 transition hover:bg-slate-50 disabled:opacity-50">Prev</button>
              <button disabled={page >= totalPages || loading} onClick={() => loadDashboard(page + 1, pageSize)} className="rounded-lg border border-slate-300 px-3 py-1.5 transition hover:bg-slate-50 disabled:opacity-50">Next</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function BucketCard({ title, subtitle, icon, items, onAction, accent }: { title: string; subtitle: string; icon: ReactNode; items: Company[]; onAction: (companyId: string, action: "done" | "snooze" | "reschedule") => void; accent: "rose" | "amber"; }) {
  const tone = accent === "rose"
    ? "from-rose-50 to-white border-rose-200"
    : "from-amber-50 to-white border-amber-200";

  return (
    <div className={`crm-surface border bg-gradient-to-br p-4 ${tone}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title} <span className="text-slate-500">({items.length})</span></h3>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <span className="rounded-full bg-white p-2 text-slate-600 shadow-sm">{icon}</span>
      </div>
      <div className="mt-3 space-y-2">
        {items.slice(0, 4).map((company) => (
          <div key={company._id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_8px_20px_-16px_rgba(15,23,42,0.45)]">
            <div className="font-medium text-slate-900">{company.name}</div>
            <div className="mt-2 flex gap-3 text-xs font-medium">
              <button className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800" onClick={() => onAction(company._id, "done")}><CheckCircle2 size={12} /> Done</button>
              <button className="text-slate-700 hover:text-slate-900" onClick={() => onAction(company._id, "snooze")}>Snooze</button>
              <button className="text-indigo-700 hover:text-indigo-900" onClick={() => onAction(company._id, "reschedule")}>Reschedule</button>
            </div>
          </div>
        ))}
        {items.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-3 py-2 text-sm text-slate-500">All clear for now.</p> : null}
      </div>
    </div>
  );
}

function StatPill({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
      <span className="text-indigo-600">{icon}</span>
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function Input({ label, value, onChange, required, type = "text" }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
    </label>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void; }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
        {options.map((opt) => <option key={opt || "all"} value={opt}>{opt || "All"}</option>)}
      </select>
    </label>
  );
}
