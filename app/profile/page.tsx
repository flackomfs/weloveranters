import Link from 'next/link';
import { ArrowLeft, AtSign, CalendarRange, MapPin, Sparkles } from 'lucide-react';

const profile = {
  name: 'Mila Hart',
  username: 'mila',
  bio: 'Writer, overthinker, and loudest quiet observer in the room. I am learning to be honest without burning out.',
  location: 'Boston, MA',
  followers: 18200,
  following: 340
};

const posts = [
  {
    id: 1,
    author: 'Mila Hart',
    handle: '@mila',
    time: '2h ago',
    content: 'Some days I feel like I am trying to hold my life together with a paperclip and a prayer. Still showing up anyway.',
    likes: 1302,
    comments: 231
  },
  {
    id: 2,
    author: 'Mila Hart',
    handle: '@mila',
    time: '1d ago',
    content: 'The weirdest part of healing is realizing you can still care and still need distance. That is not betrayal. That is self-respect.',
    likes: 1760,
    comments: 244
  }
];

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/feed" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Back to feed
        </Link>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
          <div className="h-40 bg-gradient-to-r from-pink-500 via-violet-500 to-indigo-500" />
          <div className="px-6 pb-6">
            <div className="-mt-12 flex items-end justify-between gap-4">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-pink-500 to-violet-500 text-2xl font-bold text-white">
                M
              </div>
              <button className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white">Follow</button>
            </div>

            <div className="mt-4">
              <h1 className="text-3xl font-bold">{profile.name}</h1>
              <p className="mt-1 text-slate-500">@{profile.username}</p>
            </div>

            <p className="mt-4 max-w-2xl text-slate-700">{profile.bio}</p>

            <div className="mt-5 flex flex-wrap items-center gap-5 text-sm text-slate-500">
              <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" /> {profile.location}</span>
              <span className="inline-flex items-center gap-2"><AtSign className="h-4 w-4" /> @{profile.username}</span>
              <span className="inline-flex items-center gap-2"><CalendarRange className="h-4 w-4" /> Joined 2024</span>
            </div>

            <div className="mt-5 flex gap-6 text-sm text-slate-600">
              <span><strong className="font-bold text-slate-900">{profile.following}</strong> Following</span>
              <span><strong className="font-bold text-slate-900">{profile.followers}</strong> Followers</span>
            </div>
          </div>
        </div>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
          <div className="mb-5 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-pink-500" />
            <h2 className="text-xl font-bold">Recent rants</h2>
          </div>

          <div className="space-y-4">
            {posts.map((post) => (
              <article key={post.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{post.author}</p>
                    <p className="text-sm text-slate-500">{post.handle} · {post.time}</p>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-line text-slate-700">{post.content}</p>
                <div className="mt-3 flex gap-6 text-sm text-slate-500">
                  <span>❤️ {post.likes}</span>
                  <span>💬 {post.comments}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
