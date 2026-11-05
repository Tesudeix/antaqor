"use client";

import { STATUS_LABEL } from "@/lib/contentAgentRules";
import { PENDING } from "./agentTypes";
import s from "./Agent.module.css";

export function Plats({ p }: { p: string[] }) {
  return <span className={s.plats}>{p.map((x) => <i key={x} className={`${s.pdot} ${s["p_" + x]}`} title={x}>{x === "instagram" ? "IG" : x === "facebook" ? "FB" : "TH"}</i>)}</span>;
}
export function StatusTag({ status }: { status: string }) {
  return <span className={s.stTag} data-st={status}>{PENDING.has(status) && <i className={s.spinMini} />}{STATUS_LABEL[status] || status}</span>;
}
