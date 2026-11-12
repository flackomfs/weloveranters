'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Heart, MessageCircle, Repeat2, Send, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getFirebaseAuth } from '@/lib/firebase-client';

export type FeedPost = {
  id: string;
  entryId: string;
  content: string;
  createdAt: string;
  likes: number;
  comments: number;
  reposts: number;
  authorName: string | null;
  authorUsername: string | null;
  avatarUrl: string | null;
  tags: string[];
  repostedById: string | null;
  repostedByName: string | null;
  repostedByUsername: string | null;
  isReposted: boolean;
  canDelete: boolean;
};

type PostComment = {
  id: string;
  content: string;
  createdAt: string;
  authorName: string;
  authorUsername: string;
  avatarUrl: string | null;
};

export function PostCard({ post, onChanged }: { post: FeedPost; onChanged: () => void }) {
  const [likes, setLikes] = useState(post.likes);
  const [commentCount, setCommentCount] = useState(post.comments);
  const [reposts, setReposts] = useState(post.reposts);
  const [isReposted, setIsReposted] = useState(post.isReposted);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isReposting, setIsReposting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [error, setError] = useState('');
  const pendingLikes = useRef(0);

  useEffect(() => {
    if (pendingLikes.current === 0) setLikes(post.likes);
    setCommentCount(post.comments);
    setReposts(post.reposts);
    setIsReposted(post.isReposted);
  }, [post.comments, post.isReposted, post.likes, post.reposts]);

  async function getAuthHeaders() {
    const user = getFirebaseAuth()?.currentUser;
    if (!user) throw new Error('Sign in to interact with rants.');
    return { Authorization: `Bearer ${await user.getIdToken()}` };
  }

  async function handleLike() {
    setError('');
    pendingLikes.current += 1;
    setLikes((current) => current + 1);
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like' })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to send heart.');
      if (pendingLikes.current === 1) setLikes(Number(data.likes));
    } catch (likeError) {
      setLikes((current) => Math.max(0, current - 1));
      setError(likeError instanceof Error ? likeError.message : 'Unable to send heart.');
    } finally {
      pendingLikes.current -= 1;
    }
  }

  async function loadComments() {
    setIsCommentsLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load comments.');
      setComments(data.comments);
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : 'Unable to load comments.');
    } finally {
      setIsCommentsLoading(false);
    }
  }

  async function handleToggleComments() {
    const isOpening = !isCommentsOpen;
    setIsCommentsOpen(isOpening);
    if (isOpening) await loadComments();
  }

  async function handleComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = commentText.trim();
    if (!content) return;
    setIsSubmittingComment(true);
    setError('');
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'comment', content })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to add comment.');
      setComments((current) => [...current, data.comment]);
      setCommentCount(Number(data.comments));
      setCommentText('');
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : 'Unable to add comment.');
    } finally {
      setIsSubmittingComment(false);
    }
  }

  async function handleRepost() {
    if (isReposted || isReposting) return;
    setIsReposting(true);
    setError('');
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'repost' })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to repost.');
      setIsReposted(true);
      setReposts(Number(data.reposts));
      onChanged();
    } catch (repostError) {
      setError(repostError instanceof Error ? repostError.message : 'Unable to repost.');
    } finally {
      setIsReposting(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this rant and its comments/reposts?')) return;
    setIsDeleting(true);
    setError('');
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, {
        method: 'DELETE',
        headers: await getAuthHeaders()
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to delete rant.');
      onChanged();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete rant.');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:rounded-3xl sm:p-4">
      {post.repostedByName ? (
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <Repeat2 className="h-3.5 w-3.5" />
          {post.repostedByUsername ? (
            <Link href={`/profile/${encodeURIComponent(post.repostedByUsername)}`} className="font-semibold text-slate-700 hover:text-violet-700">
              {post.repostedByName}
            </Link>
          ) : <span className="font-semibold text-slate-700">{post.repostedByName}</span>}
          <span>reposted from</span>
          {post.authorUsername ? (
            <Link href={`/profile/${encodeURIComponent(post.authorUsername)}`} className="font-semibold text-slate-700 hover:text-violet-700">
              {post.authorName || 'Member'}
            </Link>
          ) : <span className="font-semibold text-slate-700">{post.authorName || 'Member'}</span>}
        </p>
      ) : null}

      <div className="flex items-start gap-2 sm:gap-3">
        {post.avatarUrl ? (
          <Image src={post.avatarUrl} alt="" width={40} height={40} unoptimized className="h-9 w-9 rounded-full object-cover sm:h-11 sm:w-11" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-violet-500 text-xs font-bold text-white sm:h-11 sm:w-11">
            {(post.authorName || 'U').slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs sm:gap-2">
            {post.authorUsername ? (
              <Link href={`/profile/${encodeURIComponent(post.authorUsername)}`} className="font-semibold text-slate-900 hover:text-violet-700">
                {post.authorName || 'Member'}
              </Link>
            ) : <p className="font-semibold text-slate-900">{post.authorName || 'Member'}</p>}
            {post.authorUsername ? <Link href={`/profile/${encodeURIComponent(post.authorUsername)}`} className="text-slate-500 hover:text-violet-700">@{post.authorUsername}</Link> : null}
            <span className="text-slate-400">· {new Date(post.createdAt).toLocaleString()}</span>
          </div>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-5 text-slate-700 sm:mt-2.5 sm:text-[14px] sm:leading-6">{post.content}</p>

          {post.tags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
              {post.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-medium text-pink-700 sm:text-xs">
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs text-slate-500 sm:mt-3 sm:gap-5 sm:text-sm">
            <button type="button" onClick={handleLike} aria-label={`Send heart, ${likes} hearts`} className="inline-flex items-center gap-1.5 text-rose-600 hover:text-rose-700">
              <Heart className="h-4 w-4 fill-current" /> {likes}
            </button>
            <button type="button" onClick={() => void handleToggleComments()} aria-expanded={isCommentsOpen} className="inline-flex items-center gap-1.5 hover:text-violet-700">
              <MessageCircle className="h-4 w-4" /> {commentCount}
            </button>
            <button type="button" onClick={() => void handleRepost()} disabled={isReposted || isReposting} className="inline-flex items-center gap-1.5 hover:text-emerald-700 disabled:cursor-default disabled:text-emerald-700">
              <Repeat2 className="h-4 w-4" /> {isReposted ? 'Reposted' : 'Repost'} · {reposts}
            </button>
            {post.canDelete ? (
              <button type="button" onClick={() => void handleDelete()} disabled={isDeleting} className="ml-auto inline-flex items-center gap-1.5 text-rose-700 hover:text-rose-800 disabled:opacity-60">
                <Trash2 className="h-4 w-4" /> {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            ) : null}
          </div>

          {error ? <p role="alert" className="mt-2 text-xs text-rose-600">{error}</p> : null}

          {isCommentsOpen ? (
            <section aria-label="Comments" className="mt-3 border-t border-slate-200 pt-3">
              {isCommentsLoading ? <p className="py-2 text-xs text-slate-500">Loading comments...</p> : null}
              {!isCommentsLoading && comments.length === 0 ? <p className="py-2 text-xs text-slate-500">No comments yet.</p> : null}
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex items-start gap-2">
                    {comment.avatarUrl ? <Image src={comment.avatarUrl} alt="" width={28} height={28} unoptimized className="h-7 w-7 rounded-full object-cover" /> : null}
                    <div className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2">
                      <p className="text-xs font-semibold text-slate-800">
                        {comment.authorUsername ? (
                          <Link href={`/profile/${encodeURIComponent(comment.authorUsername)}`} className="hover:text-violet-700">{comment.authorName}</Link>
                        ) : comment.authorName}
                        <span className="ml-2 font-normal text-slate-400">{new Date(comment.createdAt).toLocaleString()}</span>
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleComment} className="mt-3 flex items-center gap-2">
                <input
                  aria-label="Write a comment"
                  maxLength={500}
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  placeholder="Write a comment..."
                  className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-violet-300"
                />
                <button type="submit" disabled={isSubmittingComment || !commentText.trim()} aria-label="Send comment" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-white disabled:opacity-50">
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </section>
          ) : null}
        </div>
      </div>
    </article>
  );
}
