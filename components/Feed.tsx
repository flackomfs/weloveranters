const mockPosts = [
  {
    id: 1,
    author: {
      name: 'Mila Hart',
      username: 'mila'
    },
    createdAt: '2h ago',
    content:
      'Some days I feel like I am trying to hold my life together with a paperclip and a prayer. Still showing up anyway.',
    likes: 1302,
    comments: 231,
    reposts: 42,
    tags: ['burnout', 'stress', 'reallife']
  },
  {
    id: 2,
    author: {
      name: 'Nico Flores',
      username: 'nicoflores'
    },
    createdAt: '5h ago',
    content:
      'I do not need a perfect explanation for why I am exhausted. I just need someone to recognize I am tired and not ask me to perform wellness.',
    likes: 842,
    comments: 119,
    reposts: 28,
    tags: ['mentalhealth', 'honesty']
  },
  {
    id: 3,
    author: {
      name: 'Jenna Brooks',
      username: 'jennab'
    },
    createdAt: '1d ago',
    content:
      'The weirdest thing about healing is realizing you can still love people and also need distance from them. That is not betrayal. That is self-respect.',
    likes: 1760,
    comments: 244,
    reposts: 63,
    tags: ['healing', 'boundaries']
  }
];

import { PostComposer } from '@/components/PostComposer';

export function Feed() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <span className="text-lg text-slate-400">⌕</span>
        <input
          aria-label="Search"
          placeholder="Search topics, people, or emotions"
          className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
        />
      </div>

      <PostComposer />

      <div className="mt-6 space-y-4">
        {mockPosts.map((post) => (
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
  );
}
