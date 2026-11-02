import { query } from "@/lib/db";
import { projectOwnerCondition, projectScopedAccessCondition } from "@/lib/projectAccess";

// The notes API's edit rule: the note's creator, or the owner of the project
// it is shared in.
export async function canEditNote(userId, noteId) {
  const result = await query(
    `SELECT 1
     FROM notes n
     WHERE n.id = $2
       AND ${projectScopedAccessCondition("n")}
       AND (n.user_id = $1 OR ${projectOwnerCondition("n")})
     LIMIT 1`,
    [userId, noteId]
  );
  return result.rows.length > 0;
}
