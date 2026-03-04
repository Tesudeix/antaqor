"use client";

import { useEffect, useState } from "react";

interface Story {
  _id: string;
  title: string;
  content: string;
  image: string;
  published: boolean;
  createdAt: string;
}

export default function AdminStories() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [image, setImage] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchStories = async () => {
    try {
      const res = await fetch("/api/admin/stories");
      const data = await res.json();
      if (res.ok) setStories(data.stories || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStories();
  }, []);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || saving) return;
    setSaving(true);
    try {
      const url = editingId ? `/api/admin/stories/${editingId}` : "/api/admin/stories";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), image: image.trim() }),
      });
      if (res.ok) {
        setTitle("");
        setContent("");
        setImage("");
        setEditingId(null);
        fetchStories();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (story: Story) => {
    setEditingId(story._id);
    setTitle(story.title);
    setContent(story.content);
    setImage(story.image);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Энэ түүхийг устгах уу?")) return;
    const res = await fetch(`/api/admin/stories/${id}`, { method: "DELETE" });
    if (res.ok) setStories((prev) => prev.filter((s) => s._id !== id));
  };

  const handleTogglePublish = async (story: Story) => {
    const res = await fetch(`/api/admin/stories/${story._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !story.published }),
    });
    if (res.ok) fetchStories();
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTitle("");
    setContent("");
    setImage("");
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin border-2 border-[#cc2200] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[Bebas_Neue] text-3xl tracking-[2px] md:text-4xl">
          STORY <span className="text-[#cc2200]">MANAGER</span>
        </h1>
        <p className="mt-2 text-[11px] tracking-[2px] text-[#5a5550]">
          ТҮҮХ НЭМЭХ, ЗАСАХ, УСТГАХ
        </p>
      </div>

      {/* Add/Edit form */}
      <div className="card p-6">
        <div className="mb-4 text-[10px] uppercase tracking-[2px] text-[#cc2200]">
          {editingId ? "Түүх засах" : "Шинэ түүх нэмэх"}
        </div>
        <div className="space-y-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Гарчиг..."
            className="input-dark w-full"
            maxLength={200}
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Түүхийн агуулга..."
            className="input-dark min-h-[200px] w-full resize-y"
            maxLength={10000}
          />
          <input
            type="text"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="Зургийн URL (заавал биш)..."
            className="input-dark w-full"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={!title.trim() || !content.trim() || saving}
              className="btn-blood"
            >
              {saving ? "Хадгалж байна..." : editingId ? "Шинэчлэх" : "Нэмэх"}
            </button>
            {editingId && (
              <button onClick={cancelEdit} className="btn-ghost">
                Болих
              </button>
            )}
            <span className="ml-auto text-[11px] text-[#3a3835]">
              {content.length}/10000
            </span>
          </div>
        </div>
      </div>

      {/* Stories list */}
      <div>
        <div className="mb-4 text-[10px] uppercase tracking-[2px] text-[#5a5550]">
          Нийт түүхүүд ({stories.length})
        </div>
        {stories.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="font-[Bebas_Neue] text-2xl tracking-[1px] text-[rgba(240,236,227,0.3)]">
              Түүх байхгүй
            </p>
            <p className="mt-2 text-[12px] text-[#5a5550]">
              Дээрх формоор шинэ түүх нэмнэ үү.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {stories.map((story) => (
              <div key={story._id} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-[Bebas_Neue] text-xl tracking-[1px] truncate">
                        {story.title}
                      </h3>
                      <span
                        className={`shrink-0 text-[8px] uppercase tracking-[1px] px-2 py-0.5 ${
                          story.published
                            ? "bg-green-950/50 text-green-500 border border-green-900/50"
                            : "bg-[#1c1c1c] text-[#5a5550] border border-[#1c1c1c]"
                        }`}
                      >
                        {story.published ? "Нийтлэгдсэн" : "Ноорог"}
                      </span>
                    </div>
                    <p className="mt-2 text-[12px] leading-relaxed text-[#5a5550] line-clamp-3">
                      {story.content}
                    </p>
                    <div className="mt-2 text-[10px] text-[#3a3835]">
                      {new Date(story.createdAt).toLocaleDateString("mn-MN")}
                    </div>
                  </div>
                  {story.image && (
                    <img
                      src={story.image}
                      alt=""
                      className="h-16 w-16 shrink-0 border border-[#1c1c1c] object-cover"
                    />
                  )}
                </div>
                <div className="mt-3 flex gap-2 border-t border-[#1c1c1c] pt-3">
                  <button onClick={() => handleEdit(story)} className="text-[9px] uppercase tracking-[1px] text-[#5a5550] hover:text-[#c8c8c0] transition">
                    Засах
                  </button>
                  <button onClick={() => handleTogglePublish(story)} className="text-[9px] uppercase tracking-[1px] text-[#5a5550] hover:text-[#cc2200] transition">
                    {story.published ? "Нуух" : "Нийтлэх"}
                  </button>
                  <button onClick={() => handleDelete(story._id)} className="text-[9px] uppercase tracking-[1px] text-[#5a5550] hover:text-red-500 transition">
                    Устгах
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
