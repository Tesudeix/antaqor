"use client";

import { useEffect, useState, use } from "react";
import PostCard from "@/components/PostCard";
import CommentSection from "@/components/CommentSection";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Post {
  _id: string;
  content: string;
  image?: string;
  likes: string[];
  commentsCount: number;
  createdAt: string;
  author: {
    _id: string;
    name: string;
    avatar?: string;
  };
}

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPost();
  }, [id]);

  const fetchPost = async () => {
    try {
      const res = await fetch(`/api/posts/${id}`);
      const data = await res.json();
      if (res.ok) {
        setPost(data.post);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    router.push("/");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-3 w-3 animate-pulse bg-[#cc2200]" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="py-16 text-center">
        <p className="font-[Bebas_Neue] text-2xl tracking-[2px] text-[rgba(240,236,227,0.3)]">
          Пост олдсонгүй
        </p>
        <Link href="/" className="mt-4 inline-block text-[11px] tracking-[3px] text-[#cc2200] hover:text-[#e8440f]">
          ← МЭДЭЭ РҮҮ БУЦАХ
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/" className="mb-6 inline-block text-[10px] uppercase tracking-[3px] text-[#5a5550] transition hover:text-[#cc2200]">
        ← Мэдээ рүү буцах
      </Link>
      <PostCard post={post} onDelete={handleDelete} />
      <CommentSection postId={id} />
    </div>
  );
}
