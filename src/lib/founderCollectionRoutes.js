import { founderBody } from "./founderValues";
import { query } from "./db";
import { apiError, apiNoStoreResponse, apiUnavailable } from "./apiUtils";
import { isUuid, withFounderRoomAccess } from "./founderApi";

const CONFLICT_ON_SAVE = "This item changed or was deleted by another founder. Reload before saving; your draft is still here.";
const CONFLICT_ON_DELETE = "This item changed or was deleted. Reload before deleting.";

function isRowVersion(value) {
  return /^\d+$/.test(String(value ?? ""));
}

/**
 * Builds GET/POST/PUT/DELETE handlers for a shared Founder Lobby collection.
 * Writes use the row's xmin as an optimistic version, so a stale edit or
 * delete returns 409 instead of silently overwriting another founder.
 *
 * `table`, `columns[].name` and `orderBy` are trusted constants from the route
 * module; every request value is passed as a query parameter.
 */
export function createFounderCollectionRoutes({
  table,
  columns,
  orderBy,
  parse,
  validate,
  present,
  itemName,
  listKey,
  listUnavailable,
}) {
  const names = columns.map((column) => column.name);
  const returning = ["id", ...names, "updated_at", "xmin::text AS version"].join(", ");
  const values = (item) => columns.map((column) => column.value(item));
  const userParam = names.length + 1;

  const insertSql = `INSERT INTO ${table} (${names.join(", ")}, created_by, updated_by)
    VALUES (${names.map((_, index) => `$${index + 1}`).join(", ")}, $${userParam}, $${userParam})
    RETURNING ${returning}`;
  const updateSql = `UPDATE ${table}
    SET ${names.map((name, index) => `${name} = $${index + 1}`).join(", ")},
        updated_by = $${userParam}, updated_at = NOW()
    WHERE id = $${userParam + 1} AND xmin::text = $${userParam + 2}
    RETURNING ${returning}`;

  async function readItem(request) {
    const body = founderBody(await request.json().catch(() => null));
    const item = parse(body);
    return { body, item, error: validate(item, body) };
  }

  const GET = withFounderRoomAccess(async () => {
    try {
      const result = await query(`SELECT ${returning} FROM ${table} ORDER BY ${orderBy}`);
      return apiNoStoreResponse({ [listKey]: result.rows.map(present) });
    } catch (error) {
      console.error(`Founder ${itemName} list error:`, error);
      return apiUnavailable(listUnavailable);
    }
  });

  const POST = withFounderRoomAccess(async (request) => {
    const { item, error } = await readItem(request);
    if (error) return apiError(error);

    try {
      const result = await query(insertSql, [...values(item), request.user.id]);
      return apiNoStoreResponse({ [itemName]: present(result.rows[0]) }, 201);
    } catch (dbError) {
      console.error(`Founder ${itemName} create error:`, dbError);
      return apiUnavailable(`The ${itemName} could not be created`);
    }
  });

  const PUT = withFounderRoomAccess(async (request) => {
    const { body, item, error } = await readItem(request);
    if (!isUuid(body.id)) return apiError(`A valid ${itemName} is required`);
    if (!isRowVersion(body.version)) return apiError("Reload this item before editing", 409);
    if (error) return apiError(error);

    try {
      const result = await query(updateSql, [...values(item), request.user.id, body.id, String(body.version)]);
      if (!result.rows[0]) return apiError(CONFLICT_ON_SAVE, 409);
      return apiNoStoreResponse({ [itemName]: present(result.rows[0]) });
    } catch (dbError) {
      console.error(`Founder ${itemName} update error:`, dbError);
      return apiUnavailable(`The ${itemName} could not be updated`);
    }
  });

  const DELETE = withFounderRoomAccess(async (request) => {
    const params = new URL(request.url).searchParams;
    const id = params.get("id");
    const version = params.get("version");
    if (!isUuid(id)) return apiError(`A valid ${itemName} is required`);
    if (!isRowVersion(version)) return apiError("Reload this item before deleting", 409);

    try {
      const result = await query(
        `DELETE FROM ${table} WHERE id = $1 AND xmin::text = $2 RETURNING id`,
        [id, version]
      );
      if (!result.rows[0]) return apiError(CONFLICT_ON_DELETE, 409);
      return apiNoStoreResponse({ success: true });
    } catch (dbError) {
      console.error(`Founder ${itemName} delete error:`, dbError);
      return apiUnavailable(`The ${itemName} could not be removed`);
    }
  });

  return { GET, POST, PUT, DELETE };
}
