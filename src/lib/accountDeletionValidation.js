export const ACCOUNT_DELETE_CONFIRMATION = "DELETE MY ACCOUNT";

export function validateAccountDeletionInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Request body must be an object" };
  }
  if (
    typeof input.currentPassword !== "string"
    || input.currentPassword.length === 0
    || input.currentPassword.length > 128
  ) {
    return { error: "Current password is required" };
  }
  if (input.confirmation !== ACCOUNT_DELETE_CONFIRMATION) {
    return {
      error: `Type ${ACCOUNT_DELETE_CONFIRMATION} to confirm account deletion`,
    };
  }

  return {
    value: {
      currentPassword: input.currentPassword,
    },
  };
}
