"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { isAdminEmail } from "@/lib/adminClient";
import Link from "next/link";

interface TaskData {
  _id: string;
  title: string;
  description: string;
  xpReward: number;
  assignedTo?: { _id: string; name: string; avatar?: string };
  status: "open" | "submitted" | "accepted" | "rejected";
  submissionNote: string;
  createdBy: { _id: string; name: string };
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  open: "Нээлттэй",
  submitted: "Илгээсэн",
  accepted: "Зөвшөөрсөн",
  rejected: "Татгалзсан",
};

const STATUS_COLORS: Record<string, string> = {
  open: "text-green-400 border-green-900",
  submitted: "text-yellow-400 border-yellow-900",
  accepted: "text-[#cc2200] border-[#cc2200]",
  rejected: "text-[#5a5550] border-[#5a5550]",
};

export default function TasksPage() {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [submissionNote, setSubmissionNote] = useState<Record<string, string>>({});

  const admin = isAdminEmail(session?.user?.email);
  const userId = session?.user ? (session.user as { id?: string }).id : null;

  // Admin create task fields
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newXP, setNewXP] = useState(500);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (session) fetchTasks();
    else setLoading(false);
  }, [session]);

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (res.ok) setTasks(data.tasks);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (taskId: string, action: string) => {
    const body: Record<string, string> = { action };
    if (action === "submit" && submissionNote[taskId]) {
      body.submissionNote = submissionNote[taskId];
    }
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) fetchTasks();
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm("Даалгавар устгах уу?")) return;
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    fetchTasks();
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, description: newDesc, xpReward: newXP }),
      });
      if (res.ok) {
        setNewTitle("");
        setNewDesc("");
        setNewXP(500);
        setShowCreate(false);
        fetchTasks();
      }
    } finally {
      setCreating(false);
    }
  };

  if (!session) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <h1 className="mb-4 font-[Bebas_Neue] text-4xl tracking-[2px] text-[#ede8df]">Даалгаврууд</h1>
        <p className="mb-8 text-[13px] text-[rgba(240,236,227,0.5)]">Нэвтэрч орно уу.</p>
        <Link href="/auth/signin" className="btn-blood">Нэвтрэх</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-3 w-3 animate-pulse bg-[#cc2200]" />
      </div>
    );
  }

  const openTasks = tasks.filter((t) => t.status === "open");
  const myTasks = tasks.filter((t) => t.assignedTo?._id === userId);
  const otherTasks = admin ? tasks.filter((t) => t.status === "submitted") : [];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[Bebas_Neue] text-3xl tracking-[2px] text-[#ede8df]">
            ДААЛГАВРУУД
          </h1>
          <p className="mt-1 text-[11px] tracking-[1px] text-[#5a5550]">
            Даалгавар гүйцэтгэж XP цуглуул
          </p>
        </div>
      </div>

      {/* Admin: create task */}
      {admin && (
        <div>
          {showCreate ? (
            <div className="card space-y-3 p-5">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Даалгаврын нэр"
                className="input-dark"
              />
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Тайлбар"
                rows={3}
                className="input-dark resize-none"
              />
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-[#5a5550]">XP шагнал:</label>
                <input
                  type="number"
                  min={200}
                  max={5000}
                  step={100}
                  value={newXP}
                  onChange={(e) => setNewXP(parseInt(e.target.value) || 200)}
                  className="input-dark !w-24 !py-1.5 !text-[11px]"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreate} disabled={creating} className="btn-blood !py-2 !px-5 !text-[10px]">
                  {creating ? "..." : "Үүсгэх"}
                </button>
                <button onClick={() => setShowCreate(false)} className="btn-ghost !py-2 !px-5 !text-[10px]">
                  Цуцлах
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full border border-dashed border-[#2a2825] px-4 py-3 text-[10px] uppercase tracking-[2px] text-[#5a5550] transition hover:border-[#cc2200] hover:text-[#cc2200]"
            >
              + Даалгавар үүсгэх
            </button>
          )}
        </div>
      )}

      {/* Admin: pending submissions */}
      {admin && otherTasks.length > 0 && (
        <div>
          <div className="section-label">Хүлээгдэж буй ({otherTasks.length})</div>
          <div className="space-y-3">
            {otherTasks.map((task) => (
              <div key={task._id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="text-[14px] font-bold text-[#ede8df]">{task.title}</h3>
                    {task.description && (
                      <p className="mt-1 text-[12px] text-[rgba(240,236,227,0.4)]">{task.description}</p>
                    )}
                    <div className="mt-2 text-[10px] text-[#5a5550]">
                      Гүйцэтгэсэн: {task.assignedTo?.name || "—"}
                    </div>
                    {task.submissionNote && (
                      <p className="mt-1 text-[11px] text-[rgba(240,236,227,0.6)] italic">
                        &quot;{task.submissionNote}&quot;
                      </p>
                    )}
                  </div>
                  <span className="font-[Bebas_Neue] text-lg tracking-wider text-[#cc2200]">
                    +{task.xpReward} XP
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => handleAction(task._id, "accept")} className="btn-blood !py-1.5 !px-4 !text-[9px]">
                    Зөвшөөрөх
                  </button>
                  <button onClick={() => handleAction(task._id, "reject")} className="btn-ghost !py-1.5 !px-4 !text-[9px]">
                    Татгалзах
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open tasks */}
      {openTasks.length > 0 && (
        <div>
          <div className="section-label">Нээлттэй даалгаврууд ({openTasks.length})</div>
          <div className="space-y-3">
            {openTasks.map((task) => (
              <div key={task._id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="text-[14px] font-bold text-[#ede8df]">{task.title}</h3>
                    {task.description && (
                      <p className="mt-1 text-[12px] leading-[1.7] text-[rgba(240,236,227,0.4)]">{task.description}</p>
                    )}
                  </div>
                  <span className="font-[Bebas_Neue] text-lg tracking-wider text-[#cc2200]">
                    +{task.xpReward} XP
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={() => handleAction(task._id, "claim")} className="btn-blood !py-1.5 !px-4 !text-[9px]">
                    Авах
                  </button>
                  {admin && (
                    <button onClick={() => handleDelete(task._id)} className="btn-ghost !py-1.5 !px-4 !text-[9px] !text-[#cc2200]">
                      Устгах
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My tasks */}
      {myTasks.length > 0 && (
        <div>
          <div className="section-label">Миний даалгаврууд ({myTasks.length})</div>
          <div className="space-y-3">
            {myTasks.map((task) => (
              <div key={task._id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="text-[14px] font-bold text-[#ede8df]">{task.title}</h3>
                    {task.description && (
                      <p className="mt-1 text-[12px] text-[rgba(240,236,227,0.4)]">{task.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`border px-2 py-0.5 text-[9px] uppercase tracking-[1px] ${STATUS_COLORS[task.status]}`}>
                        {STATUS_LABELS[task.status]}
                      </span>
                    </div>
                  </div>
                  <span className="font-[Bebas_Neue] text-lg tracking-wider text-[#cc2200]">
                    +{task.xpReward} XP
                  </span>
                </div>
                {(task.status === "open" || task.status === "rejected") && (
                  <div className="mt-3 space-y-2">
                    <input
                      value={submissionNote[task._id] || ""}
                      onChange={(e) => setSubmissionNote((p) => ({ ...p, [task._id]: e.target.value }))}
                      placeholder="Тэмдэглэл (заавал биш)"
                      className="input-dark !py-1.5 !text-[11px]"
                    />
                    <button onClick={() => handleAction(task._id, "submit")} className="btn-blood !py-1.5 !px-4 !text-[9px]">
                      Илгээх
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tasks.length === 0 && (
        <p className="py-12 text-center text-[12px] text-[#5a5550]">Даалгавар байхгүй байна.</p>
      )}
    </div>
  );
}
