const TRANSIENT_CONNECTION_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "ETIMEDOUT",
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08007",
  "08P01",
  "57P01",
  "57P02",
  "57P03",
]);

const TRANSIENT_CONNECTION_MESSAGES = [
  "connection terminated",
  "connection timeout",
  "connection closed unexpectedly",
  "connection ended unexpectedly",
  "client has already been closed",
  "server closed the connection unexpectedly",
  "timeout expired when trying to connect",
];

function errorChain(error) {
  const chain = [];
  let current = error;

  while (current && chain.length < 4) {
    chain.push(current);
    current = current.cause;
  }

  return chain;
}

export function isTransientDatabaseConnectionError(error) {
  return errorChain(error).some((item) => {
    if (TRANSIENT_CONNECTION_CODES.has(item?.code)) return true;

    const message = String(item?.message || item || "").toLowerCase();
    return TRANSIENT_CONNECTION_MESSAGES.some((fragment) => message.includes(fragment));
  });
}

// A SERIALIZABLE transaction aborts with 40001 when concurrent transactions
// read and write overlapping rows, and any transaction can abort with 40P01 on
// deadlock. PostgreSQL has rolled the whole transaction back, so rerunning it
// from BEGIN is safe.
const SERIALIZATION_FAILURE_CODES = new Set(["40001", "40P01"]);

export function isSerializationFailure(error) {
  return errorChain(error).some((item) => SERIALIZATION_FAILURE_CODES.has(item?.code));
}

export function isReadOnlySql(text) {
  return /^\s*(select|show)\b/i.test(String(text || ""));
}
