import AccountDeletionClient from "./AccountDeletionClient";

export const metadata = {
  title: "Delete your account",
  description:
    "Delete an Optimus account and understand how private and shared data are handled.",
};

export default function AccountDeletionPage() {
  return <AccountDeletionClient />;
}
