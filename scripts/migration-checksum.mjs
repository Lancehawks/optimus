import crypto from "node:crypto";

export function checksumSql(contents) {
  // Git normally stores SQL with LF, but Windows checkouts can expose CRLF.
  // Hash canonical bytes so the migration ledger is portable across hosts.
  const canonicalContents = contents.replace(/\r\n?/g, "\n");
  return crypto.createHash("sha256").update(canonicalContents).digest("hex");
}
