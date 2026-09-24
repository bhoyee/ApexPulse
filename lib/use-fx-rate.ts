"use client";

import { useQuery } from "@tanstack/react-query";

async function fetchFxRate(currency: string): Promise<number> {
  if (currency === "USD") return 1;
  const res = await fetch(`/api/fx?to=${currency}`);
  if (!res.ok) return 1;
  const data = await res.json();
  return Number.isFinite(data.rate) && data.rate > 0 ? data.rate : 1;
}

// Everything is stored/calculated in USD internally; this converts final
// display values to a section's native currency (e.g. NGX in NGN) without
// touching any of the underlying math.
export function useFxRate(currency: string) {
  const { data = 1 } = useQuery({
    queryKey: ["fx-rate", currency],
    queryFn: () => fetchFxRate(currency),
    enabled: currency !== "USD",
    staleTime: 5 * 60 * 1000
  });
  return currency === "USD" ? 1 : data;
}
