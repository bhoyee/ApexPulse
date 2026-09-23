"use client";

import { ReactNode, useState } from "react";
import { cn } from "../lib/utils";

interface Tab {
  id: string;
  label: string;
  badge?: string;
  content: ReactNode;
}

export function DashboardTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <div>
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              active === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.badge && (
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      {/* All tabs stay mounted (just hidden) so each section's live queries
          keep polling and don't reset/refetch on every tab switch. */}
      {tabs.map((tab) => (
        <div key={tab.id} className={active === tab.id ? "space-y-4" : "hidden"}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
