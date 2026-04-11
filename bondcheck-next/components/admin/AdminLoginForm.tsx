"use client";

import { useActionState } from "react";
import { adminLogin } from "@/actions/admin-auth";

export function AdminLoginForm() {
  const [state, formAction, isPending] = useActionState(adminLogin, null);

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-white text-lg font-bold tracking-widest uppercase">BondCheck</h1>
          <p className="text-gray-400 text-xs mt-1 tracking-wider">Admin Access</p>
        </div>

        <form action={formAction} className="bg-white rounded-lg p-6 shadow-xl">
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                autoComplete="username"
                className="w-full h-10 px-3 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0f172a] focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full h-10 px-3 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0f172a] focus:border-transparent"
              />
            </div>
          </div>

          {state?.error && (
            <p className="text-red-500 text-xs mt-3 font-medium">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full h-10 mt-5 bg-[#0f172a] text-white text-sm font-bold uppercase tracking-widest rounded-md hover:bg-[#1e293b] transition-colors disabled:opacity-50"
          >
            {isPending ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-gray-500 text-[10px] mt-4">Protected area. Authorized access only.</p>
      </div>
    </div>
  );
}
