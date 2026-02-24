"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { addToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
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

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-linear-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-on-dark flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative gradient orbs */}
        <div className="absolute top-[-20%] right-[-10%] w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-10%] w-72 h-72 bg-brand-400/8 rounded-full blur-3xl" />

        <div className="relative">
          <h1 className="text-h1 text-white! tracking-tight">Optimus</h1>
          <p className="mt-1 text-brand-300 text-body-sm">
            Personal Command Center
          </p>
        </div>

        <div className="space-y-8 relative">
          <blockquote className="text-h3 text-brand-100! font-medium! leading-relaxed">
            &ldquo;One place to manage your work, life, and everything in
            between.&rdquo;
          </blockquote>
          <div className="grid grid-cols-2 gap-3">
            {[
              "Calendars & Scheduling",
              "Journals & Notes",
              "Task Management",
              "Study Resources",
              "Saved Links",
              "Whiteboards",
            ].map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-2.5 text-body-sm text-brand-200!"
              >
                <svg
                  className="h-4 w-4 text-brand-500 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
                {feature}
              </div>
            ))}
          </div>
        </div>

        <p className="text-caption text-brand-400! relative">
          &copy; {new Date().getFullYear()} Optimus. Built for builders.
        </p>
      </div>

      {/* Right panel - login form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8 bg-surface">
        <div className="w-full max-w-100 animate-scale-in">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <h1 className="text-h2 font-bold bg-linear-to-r from-brand-400 to-brand-300 bg-clip-text text-transparent">Optimus</h1>
            <p className="text-caption mt-1">Personal Command Center</p>
          </div>

          <div className="mb-8">
            <h2 className="text-h2">Welcome back</h2>
            <p className="text-body-sm text-muted! mt-2">
              Sign in to your account to continue
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

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="text-body-sm text-heading! font-medium block">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-caption text-brand-400! hover:text-brand-300! transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                rightIcon={passwordToggle}
              />
            </div>

            <Button type="submit" isLoading={isLoading} fullWidth>
              Sign in
            </Button>
          </form>

          <div className="divider my-6" />

          <p className="text-center text-body-sm text-muted!">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-medium text-brand-400! hover:text-brand-300! transition-colors"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
