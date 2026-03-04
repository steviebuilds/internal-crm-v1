"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
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

export default function HomePage() {
  const [companies, setCompanies] = useState<MetaPayload["companies"]>([]);
  const [pipeline, setPipeline] = useState<{ status: string; count: number }[]>([]);
  const [followUps, setFollowUps] = useState<{ overdue: Company[]; dueToday: Company[] }>({
    overdue: [],
    dueToday: [],
  });
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
      setLoading(false);

      if (!res.ok) {
        setError("Failed to load companies");
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

  async function deleteCompany(id: string) {
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

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-6 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Wahlu CRM</h1>
          <p className="text-sm text-slate-600">Company pipeline, contacts, and follow-up command center.</p>
        </div>
        <button
          onClick={logout}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Log out
        </button>
      </header>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
      ) : null}

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3">
        <BucketCard title="Overdue" items={followUps.overdue} onAction={followUpAction} accent="rose" />
        <BucketCard title="Due today" items={followUps.dueToday} onAction={followUpAction} accent="amber" />
        <div className="rounded-xl border border-slate-200 p-3">
          <h3 className="font-semibold text-slate-800">Pipeline board</h3>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            {pipeline.map((p) => (
              <div key={p.status} className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="text-slate-500">{p.status}</div>
                <div className="text-lg font-semibold text-slate-900">{p.count}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <form onSubmit={createCompany} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Add company</h2>

          <Input label="Company name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} required />
          <Input label="Website" value={form.website} onChange={(v) => setForm((f) => ({ ...f, website: v }))} />
          <Input label="Industry" value={form.industry} onChange={(v) => setForm((f) => ({ ...f, industry: v }))} />
          <Input label="Emails (comma-separated)" value={form.emails} onChange={(v) => setForm((f) => ({ ...f, emails: v }))} />
          <Input label="Phones (comma-separated)" value={form.phones} onChange={(v) => setForm((f) => ({ ...f, phones: v }))} />
          <Input label="Assigned to" value={form.assignedTo} onChange={(v) => setForm((f) => ({ ...f, assignedTo: v }))} />

          <div className="grid grid-cols-2 gap-2">
            <Input label="Instagram handle" value={form.instagramHandle} onChange={(v) => setForm((f) => ({ ...f, instagramHandle: v }))} />
            <Input label="Instagram URL" value={form.instagramUrl} onChange={(v) => setForm((f) => ({ ...f, instagramUrl: v }))} />
          </div>
          <Input label="Facebook URL" value={form.facebookUrl} onChange={(v) => setForm((f) => ({ ...f, facebookUrl: v }))} />
          <Input label="LinkedIn URL" value={form.linkedinUrl} onChange={(v) => setForm((f) => ({ ...f, linkedinUrl: v }))} />
          <Input label="X URL" value={form.xUrl} onChange={(v) => setForm((f) => ({ ...f, xUrl: v }))} />
          <Input label="TikTok URL" value={form.tiktokUrl} onChange={(v) => setForm((f) => ({ ...f, tiktokUrl: v }))} />
          <Input label="YouTube URL" value={form.youtubeUrl} onChange={(v) => setForm((f) => ({ ...f, youtubeUrl: v }))} />

          <div className="grid grid-cols-3 gap-2">
            <Select
              label="Source"
              value={form.source}
              options={COMPANY_SOURCES}
              onChange={(v) => setForm((f) => ({ ...f, source: v as CompanySource }))}
            />
            <Select
              label="Status"
              value={form.status}
              options={COMPANY_STATUSES}
              onChange={(v) => setForm((f) => ({ ...f, status: v as CompanyStatus }))}
            />
            <Select
              label="Priority"
              value={form.priority}
              options={COMPANY_PRIORITIES}
              onChange={(v) => setForm((f) => ({ ...f, priority: v as CompanyPriority }))}
            />
          </div>

          <Input label="Tags (comma-separated)" value={form.tags} onChange={(v) => setForm((f) => ({ ...f, tags: v }))} />
          <Input
            label="Next follow-up"
            type="datetime-local"
            value={form.nextFollowUpAt}
            onChange={(v) => setForm((f) => ({ ...f, nextFollowUpAt: v }))}
          />

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Notes</span>
            <textarea
              className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>

          <button disabled={saving} className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">
            {saving ? "Saving..." : "Create company"}
          </button>
        </form>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-56 flex-1 text-sm">
              <span className="mb-1 block font-medium text-slate-700">Search</span>
              <input
                placeholder="Search companies"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <Select label="Status" value={statusFilter} options={["", ...COMPANY_STATUSES]} onChange={setStatusFilter} />
            <Select label="Priority" value={priorityFilter} options={["", ...COMPANY_PRIORITIES]} onChange={setPriorityFilter} />
            <button
              onClick={() => {
                setPage(1);
                loadDashboard(1, pageSize);
              }}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Apply
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-600">
                  <th className="px-3 py-3">Company</th>
                  <th className="px-3 py-3">IG</th>
                  <th className="px-3 py-3">Primary contact</th>
                  <th className="px-3 py-3">Phone</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Priority</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="px-3 py-4 text-slate-500" colSpan={7}>Loading companies...</td></tr>
                ) : companies.length === 0 ? (
                  <tr><td className="px-3 py-4 text-slate-500" colSpan={7}>No companies found.</td></tr>
                ) : (
                  companies.map((company) => {
                    const primary = company.primaryContact;
                    const phone = primary?.phones?.[0] || company.phones?.[0] || "—";
                    return (
                      <tr key={company._id} className="border-b border-slate-100 bg-white align-top transition hover:bg-slate-50/70">
                        <td className="px-3 py-3">
                          <div className="font-medium text-slate-900">{company.name}</div>
                          <div className="text-xs text-slate-500">{company.emails?.[0] || ""}</div>
                        </td>
                        <td className="px-3 py-3 text-xs">{company.instagramHandle || "—"}</td>
                        <td className="px-3 py-3">
                          <div>{primary?.fullName || "—"}</div>
                          <div className="text-xs text-slate-500">{primary?.emails?.[0] || ""}</div>
                        </td>
                        <td className="px-3 py-3">{phone}</td>
                        <td className="px-3 py-3">
                          <select className="rounded-md border border-slate-300 bg-white px-2 py-1" value={company.status} onChange={(e) => updateStatus(company._id, e.target.value)}>
                            {COMPANY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-3">{company.priority}</td>
                        <td className="px-3 py-3">
                          <div className="flex gap-2">
                            <Link href={`/companies/${company._id}`} className="rounded-md border border-slate-300 px-2 py-1 text-indigo-700 transition hover:bg-indigo-50">Details</Link>
                            <button className="rounded-md border border-rose-200 px-2 py-1 text-rose-700 transition hover:bg-rose-50" onClick={() => deleteCompany(company._id)}>Delete</button>
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
              <select value={pageSize} onChange={(e) => { const nextSize = Number(e.target.value); setPageSize(nextSize); setPage(1); loadDashboard(1, nextSize); }} className="rounded-md border border-slate-300 px-2 py-1">
                {[25, 50, 100, 200].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
              <button disabled={page <= 1 || loading} onClick={() => loadDashboard(page - 1, pageSize)} className="rounded-md border border-slate-300 px-3 py-1.5 transition hover:bg-slate-50 disabled:opacity-50">Prev</button>
              <button disabled={page >= totalPages || loading} onClick={() => loadDashboard(page + 1, pageSize)} className="rounded-md border border-slate-300 px-3 py-1.5 transition hover:bg-slate-50 disabled:opacity-50">Next</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function BucketCard({ title, items, onAction, accent }: { title: string; items: Company[]; onAction: (companyId: string, action: "done" | "snooze" | "reschedule") => void; accent: "rose" | "amber"; }) {
  const border = accent === "rose" ? "border-rose-200 bg-rose-50/50" : "border-amber-200 bg-amber-50/50";
  return (
    <div className={`rounded-xl border p-3 ${border}`}>
      <h3 className="font-semibold text-slate-800">{title} <span className="text-slate-500">({items.length})</span></h3>
      <div className="mt-2 space-y-2">
        {items.slice(0, 4).map((company) => (
          <div key={company._id} className="rounded-lg border border-slate-200 bg-white p-2">
            <div className="font-medium text-slate-900">{company.name}</div>
            <div className="mt-2 flex gap-2 text-xs">
              <button className="text-emerald-700" onClick={() => onAction(company._id, "done")}>Done</button>
              <button className="text-slate-700" onClick={() => onAction(company._id, "snooze")}>Snooze</button>
              <button className="text-indigo-700" onClick={() => onAction(company._id, "reschedule")}>Reschedule</button>
            </div>
          </div>
        ))}
        {items.length === 0 ? <p className="text-sm text-slate-500">No items.</p> : null}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, required, type = "text" }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
    </label>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void; }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
        {options.map((opt) => <option key={opt || "all"} value={opt}>{opt || "All"}</option>)}
      </select>
    </label>
  );
}
