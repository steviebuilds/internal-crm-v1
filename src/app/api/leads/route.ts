import { isAuthenticatedFromCookies } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import { badRequest, ok, unauthorized, serialize } from "@/lib/http";
import { LeadModel } from "@/lib/models/Lead";
import { leadInputSchema } from "@/lib/validation";
import { getFollowUpBuckets, getPipelineCounts, listLeads } from "@/lib/services/leads";

export async function GET(req: Request) {
  if (!(await isAuthenticatedFromCookies())) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || undefined;
    const status = searchParams.get("status") || undefined;
    const priority = searchParams.get("priority") || undefined;
    const withMeta = searchParams.get("withMeta") === "1";

    const leads = await listLeads({ q, status, priority });
    if (!withMeta) return ok(serialize(leads));

    const [pipeline, followUps] = await Promise.all([
      getPipelineCounts(),
      getFollowUpBuckets(),
    ]);

    return ok(
      serialize({
        leads,
        pipeline,
        followUps,
      }),
    );
  } catch (error) {
    return Response.json(
      { error: "Failed to load leads", details: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  if (!(await isAuthenticatedFromCookies())) return unauthorized();

  try {
    const parsed = leadInputSchema.parse(await req.json());
    await connectDb();
    const lead = await LeadModel.create(parsed);
    return ok(serialize(lead), { status: 201 });
  } catch (error) {
    return badRequest("Invalid lead payload", error);
  }
}
