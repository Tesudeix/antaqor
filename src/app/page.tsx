"use client";

import { useEffect, useState } from "react";
import PostCard from "@/components/PostCard";
import Link from "next/link";
import { useSession } from "next-auth/react";

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

export default function Home() {
  const { data: session } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchPosts = async (pageNum: number) => {
    try {
      const res = await fetch(`/api/posts?page=${pageNum}&limit=20`);
      const data = await res.json();
      if (res.ok) {
        if (pageNum === 1) {
          setPosts(data.posts);
        } else {
          setPosts((prev) => [...prev, ...data.posts]);
        }
        setHasMore(pageNum < data.pagination.pages);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts(1);
  }, []);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPosts(next);
  };

  const handleDelete = (id: string) => {
    setPosts((prev) => prev.filter((p) => p._id !== id));
  };

  return (
    <div>
      {/* Hero / Welcome */}
      <div className="mb-8 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-white">
        <h1 className="mb-2 text-3xl font-bold">Welcome to Antaqor</h1>
        <p className="mb-4 text-blue-100">
          Share your thoughts, connect with the community, and discover new ideas.
        </p>
        {session ? (
          <Link
            href="/posts/new"
            className="inline-block rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
          >
            Create a Post
          </Link>
        ) : (
          <Link
            href="/auth/signup"
            className="inline-block rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
          >
            Join the Community
          </Link>
        )}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
        </div>
      ) : posts.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-lg text-gray-500">No posts yet.</p>
          <p className="mt-1 text-sm text-gray-400">Be the first to share something!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post._id} post={post} onDelete={handleDelete} />
          ))}

          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={loadMore}
                className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Load More
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
