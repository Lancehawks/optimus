"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { AuthHeading, FormError } from "@/components/auth/AuthFrame";
import PasswordInput from "@/components/auth/PasswordInput";

function LoginFields() {
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await login(email, password, searchParams.get("redirect"));
    } catch (loginError) {
      setError(loginError.message || "Sign in failed. Try again.");
      setIsLoading(false);
    }
  };

  return (
    <>
      <AuthHeading title="Welcome back.">Sign in to the Lancehawks workspace.</AuthHeading>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          id="email"
          name="email"
          type="email"
          size="lg"
          autoComplete="email"
          inputMode="email"
          required
          disabled={isLoading}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@lancehawks.com"
        />
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="text-xs font-medium text-heading">Password</label>
            <Link href="/forgot-password" className="text-xs text-muted transition-colors hover:text-heading">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            disabled={isLoading}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your password"
          />
        </div>

        <FormError message={error} />

        <Button type="submit" size="lg" fullWidth isLoading={isLoading} rightIcon={<ArrowRight />} className="mt-2">
          {isLoading ? "Signing in" : "Sign in"}
        </Button>
      </form>

      <p className="mt-8 border-t border-border pt-5 text-xs leading-5 text-muted">
        Optimus is invite-only. If you&apos;re joining the team, ask a member to send you an invitation.
      </p>
    </>
  );
}

export default function LoginForm() {
  return (
    <Suspense fallback={null}>
      <LoginFields />
    </Suspense>
  );
}
