"use client";

import { useEffect, useState, use } from "react";
import PostCard from "@/components/PostCard";
import CommentSection from "@/components/CommentSection";
import { useRouter } from "next/navigation";

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
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg text-gray-500">Post not found</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PostCard post={post} onDelete={handleDelete} />
      <CommentSection postId={id} />
    </div>
  );
}
