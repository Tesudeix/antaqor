"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export default function NotificationBell() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [session]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications?limit=15");
      const data = await res.json();
      if (res.ok) {
        setNotifications(data.notifications);
        setUnread(data.unreadCount);
      }
    } catch {
      // silent
    }
  };

  const handleOpen = async () => {
    setOpen(!open);
    if (!open && unread > 0) {
      await fetch("/api/notifications/read", { method: "POST" });
      setUnread(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "одоо";
    if (mins < 60) return `${mins}м`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}ц`;
    const days = Math.floor(hours / 24);
    return `${days}ө`;
  };

  if (!session) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative flex h-9 w-9 items-center justify-center border border-[rgba(240,236,227,0.15)] text-[#c8c8c0] transition hover:border-[#cc2200] hover:text-[#ede8df]"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center bg-[#cc2200] text-[8px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[320px] border border-[#1c1c1c] bg-[#0f0f0f] shadow-2xl z-50">
          <div className="border-b border-[#1c1c1c] px-4 py-3">
            <span className="text-[11px] font-bold uppercase tracking-[3px] text-[#ede8df]">
              Мэдэгдэл
            </span>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-[11px] text-[#5a5550]">
                Мэдэгдэл байхгүй
              </div>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n._id}
                  href={n.link}
                  onClick={() => setOpen(false)}
                  className={`block border-b border-[rgba(28,28,28,0.5)] px-4 py-3 transition hover:bg-[rgba(204,34,0,0.05)] ${
                    !n.read ? "bg-[rgba(204,34,0,0.03)]" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-bold text-[#ede8df]">{n.title}</p>
                      <p className="mt-0.5 text-[11px] text-[#5a5550]">{n.message}</p>
                    </div>
                    <span className="shrink-0 text-[9px] text-[#5a5550]">{timeAgo(n.createdAt)}</span>
                  </div>
                  {!n.read && (
                    <div className="mt-1 h-[2px] w-4 bg-[#cc2200]" />
                  )}
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
