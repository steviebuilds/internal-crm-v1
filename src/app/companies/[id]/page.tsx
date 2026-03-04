"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ACTIVITY_TYPES, COMPANY_PRIORITIES, COMPANY_SOURCES, COMPANY_STATUSES } from "@/lib/constants";
import { Activity, Company, CompanyPriority, CompanySource, CompanyStatus, Person } from "@/lib/types";

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

type PersonForm = {
  fullName: string;
  role: string;
  phones: string;
  emails: string;
  linkedinUrl: string;
  instagramHandle: string;
  instagramUrl: string;
  notes: string;
  isPrimaryContact: boolean;
};

const EMPTY_PERSON_FORM: PersonForm = {
  fullName: "",
  role: "",
  phones: "",
  emails: "",
  linkedinUrl: "",
  instagramHandle: "",
  instagramUrl: "",
  notes: "",
  isPrimaryContact: false,
};

function parseCsv(value: string) {
  return value.split(",").map((v) => v.trim()).filter(Boolean);
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n: number) => `${n}`.padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toForm(company: Company): CompanyForm {
  return {
    name: company.name,
    website: company.website || "",
    industry: company.industry || "",
    emails: (company.emails || []).join(", "),
    phones: (company.phones || []).join(", "),
    assignedTo: company.assignedTo || "",
    instagramHandle: company.instagramHandle || "",
    instagramUrl: company.instagramUrl || "",
    facebookUrl: company.facebookUrl || "",
    linkedinUrl: company.linkedinUrl || "",
    xUrl: company.xUrl || "",
    tiktokUrl: company.tiktokUrl || "",
    youtubeUrl: company.youtubeUrl || "",
    source: company.source,
    status: company.status,
    priority: company.priority,
    tags: (company.tags || []).join(", "),
    notes: company.notes || "",
    nextFollowUpAt: toDateTimeLocal(company.nextFollowUpAt),
  };
}

export default function CompanyPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [company, setCompany] = useState<Company | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [form, setForm] = useState<CompanyForm | null>(null);
  const [personForm, setPersonForm] = useState<PersonForm>(EMPTY_PERSON_FORM);
  const [body, setBody] = useState("");
  const [type, setType] = useState<(typeof ACTIVITY_TYPES)[number]>("note");
  const [saving, setSaving] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const [companyRes, actRes, peopleRes] = await Promise.all([
      fetch(`/api/companies/${id}`),
      fetch(`/api/companies/${id}/activities`),
      fetch(`/api/companies/${id}/people?page=1&pageSize=100`),
    ]);

    if (!companyRes.ok || !actRes.ok || !peopleRes.ok) {
      setError("Failed to load company detail");
      return;
    }

    const companyData = (await companyRes.json()) as Company;
    setCompany(companyData);
    setForm(toForm(companyData));
    setActivities((await actRes.json()) as Activity[]);
    const peopleData = (await peopleRes.json()) as { people: Person[] };
    setPeople(peopleData.people || []);
  }

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function addActivity(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/companies/${id}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, body }),
    });

    setSaving(false);
    if (!res.ok) {
      setError("Failed to add activity");
      return;
    }

    setBody("");
    setType("note");
    await load();
  }

  async function addPerson(e: React.FormEvent) {
    e.preventDefault();
    if (!personForm.fullName.trim()) return;

    setSavingCompany(true);
    const res = await fetch(`/api/companies/${id}/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: id,
        fullName: personForm.fullName,
        role: personForm.role,
        phones: parseCsv(personForm.phones),
        emails: parseCsv(personForm.emails),
        linkedinUrl: personForm.linkedinUrl,
        instagramHandle: personForm.instagramHandle,
        instagramUrl: personForm.instagramUrl,
        notes: personForm.notes,
        isPrimaryContact: personForm.isPrimaryContact,
      }),
    });
    setSavingCompany(false);

    if (!res.ok) {
      setError("Failed to add person");
      return;
    }

    setPersonForm(EMPTY_PERSON_FORM);
    await load();
  }

  async function removePerson(personId: string) {
    setSavingCompany(true);
    const res = await fetch(`/api/people/${personId}`, { method: "DELETE" });
    setSavingCompany(false);

    if (!res.ok) {
      setError("Failed to remove person");
      return;
    }

    await load();
  }

  async function saveCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;

    setSavingCompany(true);
    setError(null);

    const payload = {
      ...form,
      tags: parseCsv(form.tags),
      phones: parseCsv(form.phones),
      emails: parseCsv(form.emails),
      nextFollowUpAt: form.nextFollowUpAt ? new Date(form.nextFollowUpAt).toISOString() : null,
    };

    const res = await fetch(`/api/companies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSavingCompany(false);
    if (!res.ok) {
      setError("Failed to save company changes");
      return;
    }

    await load();
  }

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-6 md:p-8">
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Company workspace</h1>
          {company ? <p className="text-sm text-slate-600">{company.name}</p> : null}
        </div>
        <Link href="/" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50">Back</Link>
      </div>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div> : null}

      {form ? (
        <form onSubmit={saveCompany} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Edit company</h2>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Name" value={form.name} onChange={(v) => setForm((f) => (f ? { ...f, name: v } : f))} required />
            <Input label="Website" value={form.website} onChange={(v) => setForm((f) => (f ? { ...f, website: v } : f))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Industry" value={form.industry} onChange={(v) => setForm((f) => (f ? { ...f, industry: v } : f))} />
            <Input label="Assigned to" value={form.assignedTo} onChange={(v) => setForm((f) => (f ? { ...f, assignedTo: v } : f))} />
          </div>
          <Input label="Emails" value={form.emails} onChange={(v) => setForm((f) => (f ? { ...f, emails: v } : f))} />
          <Input label="Phones" value={form.phones} onChange={(v) => setForm((f) => (f ? { ...f, phones: v } : f))} />
          <div className="grid grid-cols-2 gap-2">
            <Input label="Instagram handle" value={form.instagramHandle} onChange={(v) => setForm((f) => (f ? { ...f, instagramHandle: v } : f))} />
            <Input label="Instagram URL" value={form.instagramUrl} onChange={(v) => setForm((f) => (f ? { ...f, instagramUrl: v } : f))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Facebook URL" value={form.facebookUrl} onChange={(v) => setForm((f) => (f ? { ...f, facebookUrl: v } : f))} />
            <Input label="LinkedIn URL" value={form.linkedinUrl} onChange={(v) => setForm((f) => (f ? { ...f, linkedinUrl: v } : f))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input label="X URL" value={form.xUrl} onChange={(v) => setForm((f) => (f ? { ...f, xUrl: v } : f))} />
            <Input label="TikTok URL" value={form.tiktokUrl} onChange={(v) => setForm((f) => (f ? { ...f, tiktokUrl: v } : f))} />
          </div>
          <Input label="YouTube URL" value={form.youtubeUrl} onChange={(v) => setForm((f) => (f ? { ...f, youtubeUrl: v } : f))} />
          <div className="grid grid-cols-3 gap-2">
            <Select label="Source" value={form.source} options={COMPANY_SOURCES} onChange={(v) => setForm((f) => (f ? { ...f, source: v as CompanySource } : f))} />
            <Select label="Status" value={form.status} options={COMPANY_STATUSES} onChange={(v) => setForm((f) => (f ? { ...f, status: v as CompanyStatus } : f))} />
            <Select label="Priority" value={form.priority} options={COMPANY_PRIORITIES} onChange={(v) => setForm((f) => (f ? { ...f, priority: v as CompanyPriority } : f))} />
          </div>
          <Input label="Tags" value={form.tags} onChange={(v) => setForm((f) => (f ? { ...f, tags: v } : f))} />
          <Input label="Next follow-up" type="datetime-local" value={form.nextFollowUpAt} onChange={(v) => setForm((f) => (f ? { ...f, nextFollowUpAt: v } : f))} />
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Notes</span>
            <textarea className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.notes} onChange={(e) => setForm((f) => (f ? { ...f, notes: e.target.value } : f))} />
          </label>
          <button disabled={savingCompany} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">{savingCompany ? "Saving..." : "Save company"}</button>
        </form>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">People</h2>
        <form onSubmit={addPerson} className="grid gap-2 md:grid-cols-2">
          <Input label="Full name" value={personForm.fullName} onChange={(v) => setPersonForm((p) => ({ ...p, fullName: v }))} required />
          <Input label="Role" value={personForm.role} onChange={(v) => setPersonForm((p) => ({ ...p, role: v }))} />
          <Input label="Phones" value={personForm.phones} onChange={(v) => setPersonForm((p) => ({ ...p, phones: v }))} />
          <Input label="Emails" value={personForm.emails} onChange={(v) => setPersonForm((p) => ({ ...p, emails: v }))} />
          <Input label="LinkedIn URL" value={personForm.linkedinUrl} onChange={(v) => setPersonForm((p) => ({ ...p, linkedinUrl: v }))} />
          <Input label="Instagram handle" value={personForm.instagramHandle} onChange={(v) => setPersonForm((p) => ({ ...p, instagramHandle: v }))} />
          <Input label="Instagram URL" value={personForm.instagramUrl} onChange={(v) => setPersonForm((p) => ({ ...p, instagramUrl: v }))} />
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Primary contact</span>
            <input type="checkbox" checked={personForm.isPrimaryContact} onChange={(e) => setPersonForm((p) => ({ ...p, isPrimaryContact: e.target.checked }))} className="h-4 w-4" />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Notes</span>
            <textarea value={personForm.notes} onChange={(e) => setPersonForm((p) => ({ ...p, notes: e.target.value }))} className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 md:col-span-2">Add person</button>
        </form>

        {people.map((person) => (
          <div key={person._id} className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-slate-900">{person.fullName} {person.isPrimaryContact ? <span className="text-xs text-emerald-700">(Primary)</span> : null}</div>
                <div className="text-xs text-slate-600">{person.role || "—"}</div>
                <div className="text-xs text-slate-600">{(person.emails || []).join(", ") || "No emails"}</div>
                <div className="text-xs text-slate-600">{(person.phones || []).join(", ") || "No phones"}</div>
              </div>
              <button className="rounded-md border border-rose-200 px-2 py-1 text-sm text-rose-700 transition hover:bg-rose-50" onClick={() => removePerson(person._id)}>Remove</button>
            </div>
          </div>
        ))}
      </section>

      <form onSubmit={addActivity} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Quick add activity</h2>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Type</span>
          <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={type} onChange={(e) => setType(e.target.value as (typeof ACTIVITY_TYPES)[number])}>
            {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Details</span>
          <textarea required className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2" value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <button disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{saving ? "Adding..." : "Add activity"}</button>
      </form>

      <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Timeline</h2>
        {activities.length === 0 ? <p className="text-sm text-slate-500">No activity yet.</p> : null}
        {activities.map((act) => (
          <article key={act._id} className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium uppercase text-slate-700">{act.type}</span>
              <span className="text-slate-500">{new Date(act.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-2 text-sm text-slate-800">{act.body}</p>
          </article>
        ))}
      </section>
    </main>
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
