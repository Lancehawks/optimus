// SQL fragments for project-scoped access. They take no database handle, so
// routes, services and the assistant's tools all share one definition.

export function projectScopedAccessCondition(alias) {
  return `(
    (${alias}.project_id IS NULL AND ${alias}.user_id = $1)
    OR
    (
      ${alias}.project_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM project_members pm
        WHERE pm.project_id = ${alias}.project_id
          AND pm.user_id = $1
      )
    )
  )`;
}

// True when the viewer owns the project this row is shared under.
// Personal rows (project_id IS NULL) are never "project owned".
export function projectOwnerCondition(alias, viewerParam = "$1") {
  return `(
    ${alias}.project_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM projects po
      WHERE po.id = ${alias}.project_id
        AND po.user_id = ${viewerParam}
    )
  )`;
}

// The row's own creator, OR the owner of the project it's shared under.
// Use this to scope UPDATE/DELETE statements once membership has already
// been verified (e.g. via projectScopedAccessCondition).
export function creatorOrProjectOwnerCondition(alias, viewerParam = "$1") {
  return `(${alias}.user_id = ${viewerParam} OR ${projectOwnerCondition(alias, viewerParam)})`;
}

// Personal items are deletable by their creator. Once an item belongs to a
// project, deletion is reserved for the project creator.
export function projectItemDeleteCondition(alias, viewerParam = "$1") {
  return `(
    (${alias}.project_id IS NULL AND ${alias}.user_id = ${viewerParam})
    OR ${projectOwnerCondition(alias, viewerParam)}
  )`;
}
