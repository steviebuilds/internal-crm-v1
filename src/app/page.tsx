"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { LEAD_PRIORITIES, LEAD_SOURCES, LEAD_STATUSES } from "@/lib/constants";
import { Lead, LeadPriority, LeadSource, LeadStatus } from "@/lib/types";

type LeadForm = {
  company: string;
  contactName: string;
  email: string;
  phone: string;
  source: LeadSource;
  status: LeadStatus;
  priority: LeadPriority;
  value: number;
  notes: string;
  tags: string;
  nextFollowUpAt: string;
};

type MetaPayload = {
  leads: Lead[];
  pipeline: { status: string; count: number }[];
  followUps: { overdue: Lead[]; dueToday: Lead[] };
};

const EMPTY_FORM: LeadForm = {
  company: "",
  contactName: "",
  email: "",
  phone: "",
  source: "Website",
  status: "New",
  priority: "Medium",
  value: 0,
  notes: "",
  tags: "",
  nextFollowUpAt: "",
};

export default function HomePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pipeline, setPipeline] = useState<{ status: string; count: number }[]>([]);
  const [followUps, setFollowUps] = useState<{ overdue: Lead[]; dueToday: Lead[] }>({
    overdue: [],
    dueToday: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [form, setForm] = useState<LeadForm>(EMPTY_FORM);

  async function loadDashboard() {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ withMeta: "1" });
    if (query) params.set("q", query);
    if (statusFilter) params.set("status", statusFilter);
    if (priorityFilter) params.set("priority", priorityFilter);

    try {
      const res = await fetch(`/api/leads?${params.toString()}`);
      setLoading(false);

      if (!res.ok) {
        setError("Failed to load leads");
        return;
      }

      const data = (await res.json()) as MetaPayload;
      setLeads(data.leads || []);
      setPipeline(data.pipeline || []);
      setFollowUps(data.followUps || { overdue: [], dueToday: [] });
    } catch {
      setLoading(false);
      setError("CRM backend unavailable. Check Mongo connectivity.");
    }
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createLead(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      ...form,
      tags: form.tags
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      nextFollowUpAt: form.nextFollowUpAt ? new Date(form.nextFollowUpAt).toISOString() : null,
      lastTouchAt: null,
    };

    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      setError("Failed to create lead");
      return;
    }

    setForm(EMPTY_FORM);
    await loadDashboard();
  }

  async function deleteLead(id: string) {
    const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Failed to delete lead");
      return;
    }
    await loadDashboard();
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setError("Failed to update status");
      return;
    }
    await loadDashboard();
  }

  async function followUpAction(leadId: string, action: "done" | "snooze" | "reschedule") {
    const body: { leadId: string; action: string; until?: string | null } = { leadId, action };
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

    await loadDashboard();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">CRM v1</h1>
          <p className="text-sm text-slate-600">Pipeline, follow-ups, timeline-ready CRM.</p>
        </div>
        <button
          onClick={logout}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Log out
        </button>
      </header>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
      ) : null}

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3">
        <BucketCard
          title="Overdue"
          items={followUps.overdue}
          onAction={followUpAction}
          accent="rose"
        />
        <BucketCard
          title="Due today"
          items={followUps.dueToday}
          onAction={followUpAction}
          accent="amber"
        />
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

      <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <form
          onSubmit={createLead}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-semibold">Add lead</h2>

          <Input label="Company" value={form.company} onChange={(v) => setForm((f) => ({ ...f, company: v }))} required />
          <Input
            label="Contact name"
            value={form.contactName}
            onChange={(v) => setForm((f) => ({ ...f, contactName: v }))}
            required
          />
          <Input label="Email" type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} required />
          <Input label="Phone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />

          <div className="grid grid-cols-2 gap-2">
            <Select
              label="Source"
              value={form.source}
              options={LEAD_SOURCES}
              onChange={(v) => setForm((f) => ({ ...f, source: v as LeadSource }))}
            />
            <Select
              label="Priority"
              value={form.priority}
              options={LEAD_PRIORITIES}
              onChange={(v) => setForm((f) => ({ ...f, priority: v as LeadPriority }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Select
              label="Status"
              value={form.status}
              options={LEAD_STATUSES}
              onChange={(v) => setForm((f) => ({ ...f, status: v as LeadStatus }))}
            />
            <Input
              label="Value ($)"
              type="number"
              value={String(form.value)}
              onChange={(v) => setForm((f) => ({ ...f, value: Number(v) || 0 }))}
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

          <button
            disabled={saving}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-70"
          >
            {saving ? "Saving..." : "Create lead"}
          </button>
        </form>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-56 flex-1 text-sm">
              <span className="mb-1 block font-medium text-slate-700">Search</span>
              <input
                placeholder="Company or contact"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <Select label="Status" value={statusFilter} options={["", ...LEAD_STATUSES]} onChange={setStatusFilter} />
            <Select
              label="Priority"
              value={priorityFilter}
              options={["", ...LEAD_PRIORITIES]}
              onChange={setPriorityFilter}
            />
            <button
              onClick={loadDashboard}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Apply
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="px-2 py-2">Company</th>
                  <th className="px-2 py-2">Contact</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Priority</th>
                  <th className="px-2 py-2">Value</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-2 py-4 text-slate-500" colSpan={6}>
                      Loading leads...
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td className="px-2 py-4 text-slate-500" colSpan={6}>
                      No leads found.
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead._id} className="border-b border-slate-100">
                      <td className="px-2 py-2">
                        <div className="font-medium text-slate-900">{lead.company}</div>
                        <div className="text-xs text-slate-500">{lead.email}</div>
                      </td>
                      <td className="px-2 py-2">{lead.contactName}</td>
                      <td className="px-2 py-2">
                        <select
                          className="rounded-md border border-slate-300 px-2 py-1"
                          value={lead.status}
                          onChange={(e) => updateStatus(lead._id, e.target.value)}
                        >
                          {LEAD_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">{lead.priority}</td>
                      <td className="px-2 py-2">${lead.value.toLocaleString()}</td>
                      <td className="px-2 py-2">
                        <div className="flex gap-3">
                          <Link href={`/leads/${lead._id}`} className="text-indigo-600 hover:text-indigo-800">
                            Timeline
                          </Link>
                          <button
                            className="text-rose-600 hover:text-rose-800"
                            onClick={() => deleteLead(lead._id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

function BucketCard({
  title,
  items,
  onAction,
  accent,
}: {
  title: string;
  items: Lead[];
  onAction: (leadId: string, action: "done" | "snooze" | "reschedule") => void;
  accent: "rose" | "amber";
}) {
  const border = accent === "rose" ? "border-rose-200 bg-rose-50/50" : "border-amber-200 bg-amber-50/50";

  return (
    <div className={`rounded-xl border p-3 ${border}`}>
      <h3 className="font-semibold text-slate-800">
        {title} <span className="text-slate-500">({items.length})</span>
      </h3>
      <div className="mt-2 space-y-2">
        {items.slice(0, 4).map((lead) => (
          <div key={lead._id} className="rounded-lg border border-slate-200 bg-white p-2">
            <div className="font-medium text-slate-900">{lead.company}</div>
            <div className="text-xs text-slate-500">{lead.contactName}</div>
            <div className="mt-2 flex gap-2 text-xs">
              <button className="text-emerald-700" onClick={() => onAction(lead._id, "done")}>
                Done
              </button>
              <button className="text-slate-700" onClick={() => onAction(lead._id, "snooze")}>
                Snooze
              </button>
              <button className="text-indigo-700" onClick={() => onAction(lead._id, "reschedule")}>
                Reschedule
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 ? <p className="text-sm text-slate-500">No items.</p> : null}
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
      />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
      >
        {options.map((opt) => (
          <option key={opt || "all"} value={opt}>
            {opt || "All"}
          </option>
        ))}
      </select>
    </label>
  );
}
