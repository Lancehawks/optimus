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

export function isReadOnlySql(text) {
  return /^\s*(select|show)\b/i.test(String(text || ""));
}
