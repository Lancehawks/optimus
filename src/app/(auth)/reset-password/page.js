"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";
import { authService } from "@/services/api";
import { AuthHeading, FormError } from "@/components/auth/AuthFrame";
import PasswordInput from "@/components/auth/PasswordInput";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  const mismatch = confirmPassword && password !== confirmPassword;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("The passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setIsLoading(true);
    try {
      await authService.resetPassword({ token, password });
      setIsSuccess(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const signInLink = (label) => (
    <Link
      href="/"
      className="text-sm font-medium text-heading underline decoration-border-strong underline-offset-4 hover:decoration-heading"
    >
      {label}
    </Link>
  );

  if (!token) {
    return (
      <>
        <AuthHeading title="This link isn't valid.">
          The reset link is missing its token. Request a new one and use the most recent email.
        </AuthHeading>
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-heading underline decoration-border-strong underline-offset-4 hover:decoration-heading"
        >
          Request a new link
        </Link>
      </>
    );
  }

  if (isSuccess) {
    return (
      <>
        <AuthHeading title="Password updated.">
          You&apos;ve been signed out everywhere. Sign in again with your new password.
        </AuthHeading>
        {signInLink("Continue to sign in")}
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Choose a new password.">Use at least 8 characters. You&apos;ll be signed out of other devices.</AuthHeading>
      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordInput
          label="New password"
          id="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 8 characters"
        />
        <PasswordInput
          label="Confirm password"
          id="confirmPassword"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Type it again"
          error={mismatch ? "Passwords don't match" : ""}
        />
        <FormError message={error} />
        <Button type="submit" size="lg" isLoading={isLoading} fullWidth className="mt-2">
          Update password
        </Button>
      </form>
    </>
  );
}
