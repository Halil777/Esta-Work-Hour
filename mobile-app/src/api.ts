import { Platform } from "react-native";

export const BASE_URL = "http://161.104.17.113/api";

let _token: string | null = null;

export function setToken(t: string | null) {
  _token = t;
}
export function getToken() {
  return _token;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (_token) headers["Authorization"] = `Bearer ${_token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Auth ────────────────────────────────────────────────────────────────────
export interface LoginResponse {
  access_token: string;
  role: "foreman" | "site_chief";
  name: string;
  workerEntityId: string;
}

export const authApi = {
  login: (username: string, password: string) =>
    req<LoginResponse>("/mobile/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
};

// ─── Foreman ─────────────────────────────────────────────────────────────────
export interface MobileWorker {
  id: string;
  workerId: string;
  name: string;
  profession: string;
  brigadeName: string;
  mesaiSistemi: string;
  mobileRole: string;
  extraSaat: string | number;
  shift: "day" | "night" | null;
  lastCheckIn: number | null;
  lastCheckOut: number | null;
  todayHoursMs: number | null;
}

export interface UnassignedWorker {
  id: string;
  workerId: string;
  name: string;
  profession: string;
  brigadeName: string;
  mesaiSistemi: string;
  status: string;
}

export interface SiteChiefOption {
  id: string;
  workerId: string;
  name: string;
  profession: string;
}

export const foremanApi = {
  myWorkers: () => req<MobileWorker[]>("/mobile/foreman/workers"),
  unassignedWorkers: () =>
    req<UnassignedWorker[]>("/mobile/foreman/unassigned-workers"),
  claimBulk: (workerIds: string[], shift: "day" | "night" | null) =>
    req<MobileWorker[]>("/mobile/foreman/workers/claim-bulk", {
      method: "POST",
      body: JSON.stringify({ workerIds, shift }),
    }),
  claimWorker: (workerId: string) =>
    req<MobileWorker>(`/mobile/foreman/workers/${workerId}/claim`, {
      method: "POST",
    }),
  releaseWorker: (workerId: string) =>
    req<MobileWorker>(`/mobile/foreman/workers/${workerId}/release`, {
      method: "DELETE",
    }),
  setShift: (workerId: string, shift: "day" | "night") =>
    req<MobileWorker>(`/mobile/foreman/workers/${workerId}/shift`, {
      method: "PATCH",
      body: JSON.stringify({ shift }),
    }),
  siteChiefs: () => req<SiteChiefOption[]>("/mobile/foreman/site-chiefs"),
  myRequests: () => req<ExtraHoursRequest[]>("/mobile/foreman/extra-requests"),
  createRequest: (payload: {
    siteChiefWorkerEntityId: string;
    workDate: string;
    note?: string;
    items: { workerEntityId: string; extraHours: number }[];
  }) =>
    req<ExtraHoursRequest>("/mobile/foreman/extra-requests", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

// ─── Site Chief ───────────────────────────────────────────────────────────────
export const siteChiefApi = {
  incomingRequests: () =>
    req<ExtraHoursRequest[]>("/mobile/site-chief/extra-requests"),
  markSeen: (id: string) =>
    req<ExtraHoursRequest>(`/mobile/site-chief/extra-requests/${id}/seen`, {
      method: "PATCH",
    }),
  takeAction: (id: string, action: "approved" | "rejected") =>
    req<ExtraHoursRequest>(`/mobile/site-chief/extra-requests/${id}/action`, {
      method: "PATCH",
      body: JSON.stringify({ action }),
    }),
};

// ─── Shared Types ─────────────────────────────────────────────────────────────
export interface ExtraHoursRequestItem {
  id: string;
  workerEntityId: string;
  workerName: string;
  workerId: string;
  extraHours: number;
}

export interface ExtraHoursRequest {
  id: string;
  foremanWorkerEntityId: string;
  foremanName: string;
  siteChiefWorkerEntityId: string;
  siteChiefName: string;
  workDate: string;
  note: string | null;
  status: "pending" | "seen" | "approved" | "rejected";
  sentAt: string;
  seenAt: string | null;
  actionAt: string | null;
  items: ExtraHoursRequestItem[];
}
