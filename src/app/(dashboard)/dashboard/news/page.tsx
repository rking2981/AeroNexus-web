'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { format } from 'date-fns';

interface NewsPost {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
  author: { display_name: string; avatar_url: string | null };
}

export default function NewsPage() {
  const [posts, setPosts]   = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/news')
      .then(r => setPosts(r.data))
      .finally(() => setLoading(false));

    // Mark news as read — store latest seen timestamp in localStorage
    api.get('/news/latest').then(r => {
      if (r.data?.created_at) {
        localStorage.setItem('aeronexus_news_last_seen', r.data.created_at);
        window.dispatchEvent(new Event('news-read'));
      }
    });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-aero border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (posts.length === 0) return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">News & Updates</h1>
      <div className="glass-card rounded-2xl p-12 text-center text-gray-500">
        No news yet. Check back soon.
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">News &amp; Updates</h1>
      <div className="flex flex-col gap-5">
        {posts.map(post => (
          <article key={post.id} className={`glass-card rounded-2xl p-6 ${post.pinned ? 'border border-aero/30' : ''}`}>
            {post.pinned && (
              <div className="flex items-center gap-1.5 text-aero text-xs font-bold uppercase tracking-widest mb-3">
                <span>📌</span> Pinned
              </div>
            )}
            <h2 className="text-lg font-bold text-white mb-3">{post.title}</h2>
            <div
              className="prose prose-invert prose-sm max-w-none mb-4 text-gray-300"
              dangerouslySetInnerHTML={{ __html: post.body }}
            />
            <div className="flex items-center gap-2 text-xs text-gray-500 border-t border-white/5 pt-3">
              <div className="w-5 h-5 rounded-full bg-aero/20 flex items-center justify-center text-aero text-[10px] font-bold flex-shrink-0">
                {post.author.display_name[0]?.toUpperCase()}
              </div>
              <span>{post.author.display_name}</span>
              <span>·</span>
              <span>{format(new Date(post.created_at), 'MMM d, yyyy · h:mm a')}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
