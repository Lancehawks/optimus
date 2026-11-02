"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { authService } from "@/services/api";
import { AuthHeading, FormError } from "@/components/auth/AuthFrame";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await authService.forgotPassword(email);
      setIsSubmitted(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const backLink = (
    <Link href="/" className="mt-8 inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-heading">
      <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
    </Link>
  );

  if (isSubmitted) {
    return (
      <>
        <AuthHeading title="Check your inbox.">
          If an account exists for <span className="font-medium text-heading">{email}</span>, a reset link is on its way. It expires in one hour.
        </AuthHeading>
        {backLink}
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Reset your password.">
        Enter the email you use for Optimus and we&apos;ll send a link to choose a new password.
      </AuthHeading>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          id="email"
          type="email"
          size="lg"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@lancehawks.com"
        />
        <FormError message={error} />
        <Button type="submit" size="lg" isLoading={isLoading} fullWidth className="mt-2">
          Send reset link
        </Button>
      </form>
      {backLink}
    </>
  );
}
