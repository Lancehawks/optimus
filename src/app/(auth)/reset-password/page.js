"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Input, Spinner, useToast } from "@/components/ui";
import { authService } from "@/services/api";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-surface-secondary">
        <Spinner size="lg" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { addToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      addToast({ message: "Passwords do not match", type: "error" });
      return;
    }

    if (password.length < 8) {
      addToast({ message: "Password must be at least 8 characters", type: "error" });
      return;
    }

    setIsLoading(true);
    try {
      await authService.resetPassword({ token, password });
      setIsSuccess(true);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      className="text-placeholder hover:text-muted transition-colors cursor-pointer"
    >
      {showPassword ? (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )}
    </button>
  );

  if (!token) {
    return (
      <div className="app-canvas relative flex min-h-screen items-center justify-center overflow-hidden p-8">
        <div className="w-full max-w-100 text-center animate-scale-in relative">
          <div className="mb-4 text-danger">
            <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-h3 mb-2">Invalid reset link</h2>
          <p className="text-body-sm text-muted! mb-6">
            This password reset link is invalid or missing a token.
          </p>
          <Link
            href="/forgot-password"
            className="text-body-sm font-medium text-brand-400! hover:text-brand-300! transition-colors"
          >
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-canvas relative flex min-h-screen items-center justify-center overflow-hidden p-8">

      <div className="w-full max-w-100 animate-scale-in relative">
        <div className="text-center mb-8">
          <h1 className="mb-1 text-h2 font-bold text-brand-600">Optimus</h1>
          <p className="text-caption">Company Operating System</p>
        </div>

        {isSuccess ? (
          <div className="card p-8 text-center">
            <div className="mb-4 text-success">
              <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-h3 mb-2">Password reset!</h2>
            <p className="text-body-sm text-muted! mb-6">
              Your password has been updated successfully.
            </p>
            <Link href="/login">
              <Button fullWidth>Sign in</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-h2">Reset your password</h2>
              <p className="text-body-sm text-muted! mt-2">
                Enter your new password below
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="New password"
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                rightIcon={passwordToggle}
                hint="Must be at least 8 characters"
              />

              <Input
                label="Confirm new password"
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                error={confirmPassword && password !== confirmPassword ? "Passwords do not match" : ""}
              />

              <Button type="submit" isLoading={isLoading} fullWidth>
                Reset password
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
