"use client";

import { LucideIcon } from "lucide-react";

interface DashboardCardProps {
  title: string;
  value: number | string;
  icon?: LucideIcon;
  subtitle?: string;
  trend?: number;
  gradient?: string;   // ✅ ADD THIS
  loading?: boolean; 
}

export function DashboardCard({
  title,
  value,
  icon: Icon,
  subtitle,
  trend,
  gradient = "from-slate-700 to-slate-900", // ✅ default
  loading = false, // ✅ default
}: DashboardCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow transition">
      
      {/* Gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-10`} />

      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-slate-500 font-semibold">
            {title}
          </p>

          <p className="text-3xl font-bold mt-1 text-slate-900">
            {loading ? (
              <span className="inline-block h-7 w-16 bg-slate-200 animate-pulse rounded" />
            ) : (
              value
            )}
          </p>

          {subtitle && (
            <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
          )}

          {trend !== undefined && (
            <p className={`text-xs mt-1 ${trend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {trend >= 0 ? "+" : ""}
              {trend}%
            </p>
          )}
        </div>

        {Icon && (
          <div className="h-11 w-11 flex items-center justify-center rounded-xl bg-slate-900 text-white">
            <Icon size={20} />
          </div>
        )}
      </div>
    </div>
  );
}