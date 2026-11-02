"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button, Input, Spinner } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { authService } from "@/services/api";
import { AuthHeading, FormError } from "@/components/auth/AuthFrame";
import PasswordInput from "@/components/auth/PasswordInput";

function InviteFields() {
  const token = useSearchParams().get("token") || "";
  const { signup } = useAuth();
  const [invitation, setInvitation] = useState(null);
  const [status, setStatus] = useState(token ? "loading" : "invalid");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    authService
      .previewInvitation(token)
      .then((data) => {
        if (!active) return;
        setInvitation(data.invitation);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("invalid");
      });
    return () => {
      active = false;
    };
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    setIsSubmitting(true);
    try {
      await signup({ token, password, fullName });
    } catch (signupError) {
      setError(signupError.message || "We couldn't create your account.");
      setIsSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center gap-3 text-sm text-muted">
        <Spinner /> Checking your invitation
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <>
        <AuthHeading title="This link has expired.">
          Invitations work once and last seven days. Ask the person who invited you to send a new one.
        </AuthHeading>
        <Link href="/" className="text-sm font-medium text-heading underline decoration-border-strong underline-offset-4 hover:decoration-heading">
          Go to sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Join Optimus.">
        {invitation?.inviterName ? `${invitation.inviterName} invited you to the workspace.` : "You’ve been invited to the workspace."}{" "}
        Set up your account to get started.
      </AuthHeading>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Email" id="email" type="email" size="lg" value={invitation?.email || ""} readOnly disabled />
        <Input
          label="Full name"
          id="fullName"
          name="fullName"
          size="lg"
          autoComplete="name"
          required
          maxLength={150}
          disabled={isSubmitting}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Your name"
        />
        <PasswordInput
          label="Password"
          id="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={isSubmitting}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 8 characters"
        />
        <FormError message={error} />
        <Button type="submit" size="lg" fullWidth isLoading={isSubmitting} rightIcon={<ArrowRight />} className="mt-2">
          Create account
        </Button>
      </form>
    </>
  );
}

export default function InviteForm() {
  return (
    <Suspense fallback={null}>
      <InviteFields />
    </Suspense>
  );
}
