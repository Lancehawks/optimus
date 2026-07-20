"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Eye, EyeOff } from "lucide-react";
import { Button, Input, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

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
      {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.8} /> : <Eye className="h-4 w-4" strokeWidth={1.8} />}
    </button>
  );

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Left panel - branding */}
      <div className="auth-brand-panel relative hidden overflow-hidden p-12 lg:flex lg:w-1/2 lg:flex-col lg:justify-between">

        <div className="relative">
          <Link href="/" className="block">
            <h1 className="text-h1 text-white! tracking-tight">Optimus</h1>
            <p className="mt-1 text-brand-300 text-body-sm">
              Company Operating System
            </p>
          </Link>
        </div>

        <div className="space-y-8 relative">
          <blockquote className="max-w-lg text-h3 font-medium! leading-relaxed text-white!">
            &ldquo;One clear operating picture for the people building the company.&rdquo;
          </blockquote>
          <div className="grid grid-cols-2 gap-3">
            {[
              "Company calendar",
              "Knowledge workspace",
              "Task operations",
              "Project portfolio",
              "Shared resources",
              "Visual planning",
            ].map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-2.5 text-body-sm text-white/70!"
              >
                <Check className="h-4 w-4 shrink-0 text-[#62d3b2]" strokeWidth={2} />
                {feature}
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-caption text-white/40!">
          &copy; {new Date().getFullYear()} <a href="https://lancehawks.com" target="_blank" rel="noopener noreferrer" className="hover:text-brand-400 transition-colors">Lancehawks</a>. Built for builders.
        </p>
      </div>

      {/* Right panel - login form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8 bg-surface">
        <div className="w-full max-w-100 animate-scale-in">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <Link href="/">
              <h1 className="text-h2 font-bold text-brand-600">
                Optimus
              </h1>
              <p className="text-caption mt-1">Company Operating System</p>
            </Link>
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
                <label
                  htmlFor="password"
                  className="text-body-sm text-heading! font-medium block"
                >
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
