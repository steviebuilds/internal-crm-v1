import { isAuthenticatedFromCookies } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import { badRequest, ok, serialize, unauthorized } from "@/lib/http";
import { CompanyModel } from "@/lib/models/Company";
import { companyInputSchema } from "@/lib/validation";
import { getFollowUpBuckets, getPipelineCounts, listCompanies } from "@/lib/services/companies";

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

const INVALID_COMPANY_NAME_TOKENS = new Set([
  "-",
  "—",
  "n/a",
  "na",
  "unknown",
  "null",
  "undefined",
  "none",
]);

function hasCanonicalCompanyName(value: unknown) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !INVALID_COMPANY_NAME_TOKENS.has(trimmed.toLowerCase());
}

export async function GET(req: Request) {
  if (!(await isAuthenticatedFromCookies())) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || undefined;
    const status = searchParams.get("status") || undefined;
    const priority = searchParams.get("priority") || undefined;
    const withMeta = searchParams.get("withMeta") === "1";
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 50);

    const { companies, pagination } = await listCompanies({ q, status, priority, page, pageSize });
    const canonicalCompanies = companies.filter((company) => hasCanonicalCompanyName((company as { name?: unknown }).name));

    if (!withMeta) {
      return ok(
        serialize({
          companies: canonicalCompanies,
          ...pagination,
          total: canonicalCompanies.length < companies.length ? canonicalCompanies.length : pagination.total,
        }),
      );
    }

    const [pipeline, followUps] = await Promise.all([
      getPipelineCounts(),
      getFollowUpBuckets(),
    ]);

    return ok(
      serialize({
        companies: canonicalCompanies,
        pipeline,
        followUps,
        ...pagination,
        total: canonicalCompanies.length < companies.length ? canonicalCompanies.length : pagination.total,
      }),
    );
  } catch (error) {
    const details = getErrorMessage(error);
    return ok({ error: "Failed to load companies", details }, { status: 503 });
  }
}

export async function POST(req: Request) {
  if (!(await isAuthenticatedFromCookies())) return unauthorized();

  try {
    const parsed = companyInputSchema.parse(await req.json());
    await connectDb();
    const company = await CompanyModel.create(parsed);
    return ok(serialize(company), { status: 201 });
  } catch (error) {
    return badRequest("Invalid company payload", error);
  }
}
