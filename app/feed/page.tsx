"use client";

import Link from 'next/link';
import { Bell, BookHeart, Compass, Home, LogIn, Search, Settings, User } from 'lucide-react';
import { ComposeRant } from '@/components/compose-rant';
import { MOCK_POSTS, MOCK_TRENDS, MOCK_USERS } from '@/lib/mock-data';

export default function FeedPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="hidden w-72 shrink-0 xl:block">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-violet-500 text-lg font-bold text-white">
                W
              </div>
              <div>
                <p className="text-xl font-bold">WeLoveRanters</p>
                <p className="text-sm text-slate-500">Your daily release</p>
              </div>
            </div>

            <nav className="space-y-2">
              {[
                { label: 'Home', icon: Home, active: true },
                { label: 'Explore', icon: Compass },
                { label: 'Notifications', icon: Bell },
                { label: 'Profile', icon: User },
                { label: 'Settings', icon: Settings }
              ].map(({ label, icon: Icon, active }) => (
                <Link
                  key={label}
                  href={label === 'Profile' ? '/profile/iamnotokay' : '/feed'}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    active ? 'bg-pink-50 text-pink-700' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </nav>

            <div className="mt-8 rounded-2xl bg-slate-900 p-4 text-white">
              <p className="text-sm font-semibold">Need a quiet moment?</p>
              <p className="mt-2 text-sm text-slate-300">Take a breath. You are not behind; you are just processing.</p>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-soft">
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Search className="h-5 w-5 text-slate-400" />
              <input
                aria-label="Search"
                placeholder="Search topics, people, or emotions"
                className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>

            <ComposeRant />

            <div className="mt-6 space-y-4">
              {MOCK_POSTS.map((post) => (
                <article key={post.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-violet-500 text-sm font-bold text-white">
                      {post.author.name.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{post.author.name}</p>
                        <span className="text-sm text-slate-500">@{post.author.username}</span>
                        <span className="text-sm text-slate-400">· {post.createdAt}</span>
                      </div>
                      <p className="mt-3 whitespace-pre-line text-[15px] leading-7 text-slate-700">{post.content}</p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {post.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-pink-100 px-2.5 py-1 text-xs font-medium text-pink-700">
                            #{tag}
                          </span>
                        ))}
                      </div>

                      <div className="mt-4 flex items-center gap-6 text-sm text-slate-500">
                        <span>❤️ {post.likes}</span>
                        <span>💬 {post.comments}</span>
                        <span>↻ {post.reposts}</span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </main>

        <aside className="hidden w-80 shrink-0 lg:block">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Trending</h3>
              <BookHeart className="h-4 w-4 text-pink-500" />
            </div>
            <div className="space-y-4">
              {MOCK_TRENDS.map((trend, index) => (
                <div key={trend.topic} className="flex items-start gap-3">
                  <span className="text-sm font-semibold text-slate-400">0{index + 1}</span>
                  <div>
                    <p className="font-medium text-slate-800">#{trend.topic}</p>
                    <p className="text-sm text-slate-500">{trend.posts} posts</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl bg-slate-900 p-4 text-white">
              <p className="text-base font-semibold">Suggested accounts</p>
              <div className="mt-4 space-y-3">
                {MOCK_USERS.slice(0, 3).map((user) => (
                  <div key={user.username} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-violet-500 text-xs font-bold text-white">
                        {user.name.slice(0, 1)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-slate-400">@{user.username}</p>
                      </div>
                    </div>
                    <button className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-900">Follow</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
