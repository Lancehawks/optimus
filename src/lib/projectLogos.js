function runQuery(db, text, params) {
  return typeof db === "function" ? db(text, params) : db.query(text, params);
}

// An uploaded logo the member owns that no other project uses.
export async function findProjectLogoFile(db, userId, fileId, exceptProjectId = null) {
  const result = await runQuery(
    db,
    `SELECT f.id
     FROM uploaded_files f
     WHERE f.id = $1
       AND f.user_id = $2
       AND f.purpose = 'project_logo'
       AND NOT EXISTS (
         SELECT 1 FROM projects other
         WHERE other.logo_file_id = f.id AND ($3::uuid IS NULL OR other.id <> $3::uuid)
       )`,
    [fileId, userId, exceptProjectId]
  );
  return result.rows[0] || null;
}

// Removes logo rows that no project points to any more. Returns their blob
// pathnames, to delete once the transaction has committed.
export async function releaseProjectLogoFiles(db, fileIds) {
  const ids = [...new Set(fileIds.filter(Boolean))];
  if (ids.length === 0) return [];
  const result = await runQuery(
    db,
    `DELETE FROM uploaded_files f
     WHERE f.id = ANY($1::uuid[])
       AND f.purpose = 'project_logo'
       AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.logo_file_id = f.id)
     RETURNING f.pathname`,
    [ids]
  );
  return result.rows.map((row) => row.pathname);
}
