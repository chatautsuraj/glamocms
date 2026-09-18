"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Lock, Mail, Sparkles } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_PASSWORD } from "@/lib/store";
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
      toast.success("Welcome to Glamo Nepal");
      const users = (await import("@/lib/store")).useAppStore.getState().users;
      const matched = users.find((u) => u.email === email.trim().toLowerCase());
      router.push(matched ? postLoginPath(matched) : "/dashboard");
    } else {
      toast.error("Invalid email or password");
    }
  };

  return (
    <div className="relative flex min-h-screen">
      <div className="absolute inset-0 atmospheric-bg" />

      <div className="relative hidden w-[48%] flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse at 20% 20%, rgba(255,255,255,0.25), transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(0,0,0,0.2), transparent 45%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
            <span className="text-lg font-bold">G</span>
          </div>
          <div>
            <p className="text-xl font-semibold tracking-tight font-display">Glamo Nepal</p>
            <p className="text-xs text-primary-foreground/70">Store CMS &amp; POS</p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="relative"
        >
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> Cosmetics retail
          </p>
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight">
            One counter.
            <br />
            One catalog.
            <br />
            One stock truth.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-primary-foreground/80">
            Add products, manage stock, take POS sales, track orders and delivery — all in
            Glamo Nepal&apos;s store system.
          </p>
        </motion.div>

        <p className="relative text-sm text-primary-foreground/55">© 2026 Glamo Nepal</p>
      </div>

      <div className="relative flex flex-1 items-center justify-center p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-md"
        >
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <span className="font-bold">G</span>
              </div>
              <span className="text-xl font-semibold">Glamo Nepal</span>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card/95 p-8 shadow-lg backdrop-blur">
            <h2 className="text-2xl font-semibold tracking-tight">Staff sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              For Glamo Nepal store team only
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="space-y-2">
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
              <div className="space-y-2">
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Continue"}
                <ArrowRight className="h-4 w-4" />
              </Button>

              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => {
                  setEmail(STAFF_EMAIL);
                  setPassword(DEMO_PASSWORD);
                }}
              >
                Fill demo staff login
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
