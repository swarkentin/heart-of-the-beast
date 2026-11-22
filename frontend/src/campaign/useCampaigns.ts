import { useEffect, useState } from "react";
import { apiRequest } from "../api";
import { loadUntilReady } from "../startupLoad";
import type { ApiCampaign } from "./campaigns";

// The campaign catalog rarely changes: fetch it once per page and share it. It retries until the server answers,
// since the page can load before a sleeping server wakes.
let cached: ApiCampaign[] | null = null;
let pending: Promise<ApiCampaign[]> | null = null;

export function useCampaigns(): ApiCampaign[] {
  const [campaigns, setCampaigns] = useState<ApiCampaign[]>(cached ?? []);
  useEffect(() => {
    if (cached) return;
    pending ??= loadUntilReady(() => apiRequest<{ campaigns: ApiCampaign[] }>("/campaigns"), { signal: new AbortController().signal }).then(result => (cached = result.campaigns ?? []));
    let active = true;
    pending.then(list => { if (active) setCampaigns(list); }).catch(() => { pending = null; });
    return () => { active = false; };
  }, []);
  return campaigns;
}
