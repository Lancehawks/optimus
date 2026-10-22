// Memory: short notes a member writes about themselves (their role, how they
// plan, how they like answers). A conversation copies them when it starts, so
// the prompt of an ongoing conversation never changes; edits apply to new
// conversations. `db` has query(text, params).

export const MEMORY_ITEM_MAX_LENGTH = 500;
export const MEMORY_ITEMS_MAX = 50;

export class MemoryError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function cleanContent(value) {
  const content = typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : "";
  if (!content) throw new MemoryError("Write something to remember");
  if (content.length > MEMORY_ITEM_MAX_LENGTH) {
    throw new MemoryError(`Keep each memory under ${MEMORY_ITEM_MAX_LENGTH} characters`);
  }
  return content;
}

export async function listMemories(db, userId) {
  const result = await db.query(
    `SELECT id, content, created_at, updated_at FROM assistant_memories
     WHERE user_id = $1 ORDER BY created_at, id`,
    [userId]
  );
  return result.rows;
}

export async function addMemory(db, userId, value) {
  const content = cleanContent(value);
  const result = await db.query(
    `INSERT INTO assistant_memories (user_id, content)
     SELECT $1, $2
     WHERE (SELECT COUNT(*) FROM assistant_memories WHERE user_id = $1) < $3
     RETURNING id, content, created_at, updated_at`,
    [userId, content, MEMORY_ITEMS_MAX]
  );
  if (!result.rows[0]) {
    throw new MemoryError(`You can keep up to ${MEMORY_ITEMS_MAX} memories. Remove one to add another.`, 409);
  }
  return result.rows[0];
}

export async function updateMemory(db, userId, id, value) {
  const content = cleanContent(value);
  const result = await db.query(
    `UPDATE assistant_memories SET content = $3
     WHERE id = $1 AND user_id = $2
     RETURNING id, content, created_at, updated_at`,
    [id, userId, content]
  );
  if (!result.rows[0]) throw new MemoryError("Memory not found", 404);
  return result.rows[0];
}

export async function deleteMemory(db, userId, id) {
  const result = await db.query(
    "DELETE FROM assistant_memories WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, userId]
  );
  if (!result.rows[0]) throw new MemoryError("Memory not found", 404);
}

// The text a new conversation stores, one memory per line.
export function memorySnapshot(memories) {
  if (!memories?.length) return null;
  return memories.map((memory) => `- ${memory.content.replace(/\s+/g, " ").trim()}`).join("\n");
}
