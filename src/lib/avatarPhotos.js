import { photoAvatarValue } from "./avatarOptions.js";

function runQuery(db, text, params) {
  return typeof db === "function" ? db(text, params) : db.query(text, params);
}

// An uploaded profile photo the member owns.
export async function findAvatarPhoto(db, userId, fileId) {
  const result = await runQuery(
    db,
    "SELECT id FROM uploaded_files WHERE id = $1 AND user_id = $2 AND purpose = 'avatar'",
    [fileId, userId]
  );
  return result.rows[0] || null;
}

// Removes a replaced photo unless it is still someone's avatar. Returns its
// blob pathname, to delete once the change has been saved.
export async function releaseAvatarPhoto(db, userId, fileId) {
  if (!fileId) return [];
  const result = await runQuery(
    db,
    `DELETE FROM uploaded_files f
     WHERE f.id = $1 AND f.user_id = $2 AND f.purpose = 'avatar'
       AND NOT EXISTS (SELECT 1 FROM users u WHERE u.avatar_url = $3)
     RETURNING f.pathname`,
    [fileId, userId, photoAvatarValue(fileId)]
  );
  return result.rows.map((row) => row.pathname);
}
