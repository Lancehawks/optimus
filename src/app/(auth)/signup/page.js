"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Button, Input, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signup } = useAuth();
  const { addToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      addToast({ message: "Passwords do not match", type: "error" });
      return;
    }

    if (password.length < 8) {
      addToast({
        message: "Password must be at least 8 characters",
        type: "error",
      });
      return;
    }

    setIsLoading(true);
    try {
      await signup(email, password, fullName);
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
      {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.8} /> : <Eye className="h-4 w-4" strokeWidth={1.8} />}
    </button>
  );

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Left panel - branding */}
      <div className="auth-brand-panel relative hidden overflow-hidden p-12 lg:flex lg:w-1/2 lg:flex-col lg:justify-between">

        <div className="relative">
          <h1 className="text-h1 text-white! tracking-tight">Optimus</h1>
          <p className="mt-1 text-brand-300 text-body-sm">
            Company Operating System
          </p>
        </div>

        <div className="space-y-6 relative">
          <h2 className="text-h2 text-brand-100!">
            Join the company workspace
          </h2>
          <p className="max-w-lg text-body text-white/65!">
            Tasks, notes, calendars, research, bookmarks, and more — all in one
            place, designed for focused internal work.
          </p>
        </div>

        <p className="relative text-caption text-white/40!">
          &copy; {new Date().getFullYear()}{" "}
          <a
            href="https://lancehawks.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-brand-400 transition-colors"
          >
            Lancehawks
          </a>
          . Built for builders.
        </p>
      </div>

      {/* Right panel - signup form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8 bg-surface">
        <div className="w-full max-w-100 animate-scale-in">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <h1 className="text-h2 font-bold text-brand-600">
              Optimus
            </h1>
            <p className="text-caption mt-1">Company Operating System</p>
          </div>

          <div className="mb-8">
            <h2 className="text-h2">Create your account</h2>
            <p className="text-body-sm text-muted! mt-2">
              Request access to the internal workspace
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Full name"
              id="fullName"
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
            />

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

            <Input
              label="Password"
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
              label="Confirm password"
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              error={
                confirmPassword && password !== confirmPassword
                  ? "Passwords do not match"
                  : ""
              }
            />

            <Button type="submit" isLoading={isLoading} fullWidth>
              Create account
            </Button>
          </form>

          <div className="divider my-6" />

          <p className="text-center text-body-sm text-muted!">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-brand-400! hover:text-brand-300! transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
