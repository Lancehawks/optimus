"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { useToast } from "@/components/ui";
import { authService } from "@/services/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { addToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await authService.forgotPassword(email);
      setIsSubmitted(true);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-8 bg-surface-secondary relative overflow-hidden">
      <div className="absolute top-[-30%] right-[-20%] w-150 h-150 bg-brand-500/8 rounded-full blur-3xl" />
      <div className="absolute bottom-[-20%] left-[-15%] w-100 h-100 bg-brand-400/6 rounded-full blur-3xl" />

      <div className="w-full max-w-100 animate-scale-in relative">
        <div className="text-center mb-8">
          <h1 className="text-h2 font-bold bg-linear-to-r from-brand-400 to-brand-300 bg-clip-text text-transparent mb-1">Optimus</h1>
          <p className="text-caption">Personal Command Center</p>
        </div>

        {isSubmitted ? (
          <div className="card p-8 text-center">
            <div className="mb-4 text-success">
              <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-h3 mb-2">Check your email</h2>
            <p className="text-body-sm text-muted! mb-6">
              If an account exists with <strong>{email}</strong>, we&apos;ve sent a password reset link.
            </p>
            <Link
              href="/login"
              className="text-body-sm font-medium text-brand-400! hover:text-brand-300! transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-h2">Forgot password?</h2>
              <p className="text-body-sm text-muted! mt-2">
                Enter your email and we&apos;ll send you a reset link
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Email address"
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />

              <Button type="submit" isLoading={isLoading} fullWidth>
                Send reset link
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="text-body-sm text-muted! hover:text-heading! transition-colors"
              >
                &larr; Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
