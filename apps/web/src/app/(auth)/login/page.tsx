"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const STAFF_EMAIL = "manager@glamonepal.com";

export default function LoginPage() {
  const { login, postLoginPath } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState(STAFF_EMAIL);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const ok = await login(email, password, "client");
    setLoading(false);
    if (ok) {
      toast.success("Signed in");
      const users = (await import("@/lib/store")).useAppStore.getState().users;
      const matched = users.find((u) => u.email === email.trim().toLowerCase());
      router.push(matched ? postLoginPath(matched) : "/dashboard");
    } else {
      toast.error("Invalid email or password");
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden w-[44%] flex-col justify-between border-r border-border bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-primary-foreground/15">
            <span className="text-sm font-bold">G</span>
          </div>
          <div>
            <p className="font-display text-lg font-semibold tracking-tight">Glamo Nepal</p>
            <p className="text-xs text-primary-foreground/70">Store CMS &amp; POS</p>
          </div>
        </div>

        <div>
          <h1 className="max-w-sm text-3xl font-semibold leading-snug tracking-tight">
            Counter sales, stock, and orders — one system for the shop floor.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-primary-foreground/75">
            Built for Glamo Nepal staff: products, inventory, POS, phone orders, and delivery.
          </p>
        </div>

        <p className="text-sm text-primary-foreground/55">© 2026 Glamo Nepal</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-primary text-primary-foreground">
                <span className="font-bold">G</span>
              </div>
              <span className="font-display text-lg font-semibold">Glamo Nepal</span>
            </div>
          </div>

          <div className="border border-border bg-card p-6 sm:p-7">
            <h2 className="text-xl font-semibold tracking-tight">Staff sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">Store team access only</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-10"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
