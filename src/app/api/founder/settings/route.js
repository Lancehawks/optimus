import { founderBody } from "@/lib/founderValues";
import { query } from "@/lib/db";
import { apiError, apiNoStoreResponse, apiUnavailable } from "@/lib/apiUtils";
import {
  cleanText,
  numericValue,
  optionalDate,
  withFounderRoomAccess,
} from "@/lib/founderApi";

function presentSettings(row) {
  return {
    companyStartedOn: row.company_started_on,
    salesTarget: Number(row.sales_target || 0),
    salesCurrency: "INR",
    updatedAt: row.updated_at,
  };
}

export const GET = withFounderRoomAccess(async () => {
  try {
    const result = await query(
      `SELECT company_started_on, sales_target, sales_currency, updated_at
       FROM founder_lobby_settings WHERE id = 1`
    );
    if (!result.rows[0]) return apiUnavailable("Founder Lobby settings are unavailable");
    return apiNoStoreResponse({ settings: presentSettings(result.rows[0]) });
  } catch (error) {
    console.error("Founder Lobby settings read error:", error);
    return apiUnavailable("Founder Lobby settings are temporarily unavailable");
  }
});

export const PUT = withFounderRoomAccess(async (request) => {
  const body = founderBody(await request.json().catch(() => null));
  const hasStartedOn = Object.prototype.hasOwnProperty.call(body, "companyStartedOn");
  const hasSalesTarget = Object.prototype.hasOwnProperty.call(body, "salesTarget");
  const hasCurrency = Object.prototype.hasOwnProperty.call(body, "salesCurrency");

  if (!hasStartedOn && !hasSalesTarget && !hasCurrency) {
    return apiError("Choose at least one Founder Lobby setting to update");
  }

  const startedOn = hasStartedOn ? optionalDate(body.companyStartedOn) : null;
  const salesTarget = hasSalesTarget ? numericValue(body.salesTarget) : 0;
  const salesCurrency = hasCurrency ? cleanText(body.salesCurrency, 8).toUpperCase() : "";

  if (hasStartedOn && startedOn === undefined) return apiError("Choose a valid company start date");
  if (hasSalesTarget && (salesTarget === null || salesTarget < 0 || salesTarget > 999999999999)) {
    return apiError("Choose a valid sales target");
  }
  if (hasCurrency && salesCurrency !== "INR") {
    return apiError("Founder Lobby commercial values use INR");
  }

  try {
    const result = await query(
      `UPDATE founder_lobby_settings
       SET company_started_on = CASE WHEN $1 THEN $2::date ELSE company_started_on END,
           sales_target = CASE WHEN $3 THEN $4::numeric ELSE sales_target END,
           sales_currency = CASE WHEN $5 THEN $6 ELSE sales_currency END,
           updated_by = $7,
           updated_at = NOW()
       WHERE id = 1
       RETURNING company_started_on, sales_target, sales_currency, updated_at`,
      [
        hasStartedOn,
        startedOn,
        hasSalesTarget,
        salesTarget,
        hasCurrency,
        salesCurrency,
        request.user.id,
      ]
    );
    if (!result.rows[0]) return apiUnavailable("Founder Lobby settings are unavailable");
    return apiNoStoreResponse({ settings: presentSettings(result.rows[0]) });
  } catch (error) {
    console.error("Founder Lobby settings update error:", error);
    return apiUnavailable("Founder Lobby settings could not be updated");
  }
});
