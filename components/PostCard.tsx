'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Flag, Heart, MessageCircle, Pencil, Repeat2, Send, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getFirebaseAuth } from '@/lib/firebase-client';
import { RichText } from '@/components/RichText';

export type FeedPost = {
  id: string;
  entryId: string;
  content: string;
  createdAt: string;
  updatedAt: string | null;
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
  verificationBadge: 'boy' | 'girl' | 'moderator' | null;
  isReposted: boolean;
  canDelete: boolean;
  canEdit: boolean;
  canReport: boolean;
};

type PostComment = {
  id: string;
  content: string;
  parentCommentId: string | null;
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
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [editedContent, setEditedContent] = useState(post.content);
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState('harassment');
  const [reportDetails, setReportDetails] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportMessage, setReportMessage] = useState('');
  const [error, setError] = useState('');
  const pendingLikes = useRef(0);
  const commentInputRef = useRef<HTMLInputElement>(null);

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
        body: JSON.stringify({ action: 'comment', content, parentCommentId: replyTo?.id || null })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to add comment.');
      setComments((current) => [...current, data.comment]);
      setCommentCount(Number(data.comments));
      setCommentText('');
      setReplyTo(null);
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

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = editedContent.trim();
    if (!content || content.length > 2000) return;
    setIsSavingEdit(true);
    setError('');
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, {
        method: 'PATCH',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to edit rant.');
      setIsEditing(false);
      onChanged();
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : 'Unable to edit rant.');
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmittingReport(true);
    setError('');
    setReportMessage('');
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, reason: reportReason, details: reportDetails })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to report post.');
      setIsReporting(false);
      setReportDetails('');
      setReportMessage('Report sent to moderators for review.');
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : 'Unable to report post.');
    } finally {
      setIsSubmittingReport(false);
    }
  }

  function startReply(comment: PostComment) {
    setReplyTo({ id: comment.id, name: comment.authorName });
    commentInputRef.current?.focus();
  }

  const topLevelComments = comments.filter((comment) => !comment.parentCommentId);

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
            {post.verificationBadge ? (
              <Image
                src={post.verificationBadge === 'moderator'
                  ? '/badges/moderator.gif'
                  : post.verificationBadge === 'boy' ? '/badges/boys-verified.gif' : '/badges/girls-verified.gif'}
                alt={`${post.verificationBadge} verified badge`}
                width={18}
                height={18}
                unoptimized
                className="h-[18px] w-[18px] shrink-0 object-contain"
              />
            ) : null}
            {post.authorUsername ? <Link href={`/profile/${encodeURIComponent(post.authorUsername)}`} className="text-slate-500 hover:text-violet-700">@{post.authorUsername}</Link> : null}
            <span className="text-slate-400">· {new Date(post.createdAt).toLocaleString()}{post.updatedAt && post.updatedAt !== post.createdAt ? ' · edited' : ''}</span>
          </div>
          {isEditing ? (
            <form onSubmit={handleSaveEdit} className="mt-2 space-y-2">
              <textarea
                autoFocus
                maxLength={2000}
                value={editedContent}
                onChange={(event) => setEditedContent(event.target.value)}
                aria-label="Edit rant"
                className="w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setIsEditing(false); setEditedContent(post.content); }} className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600">Cancel</button>
                <button type="submit" disabled={isSavingEdit || !editedContent.trim()} className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{isSavingEdit ? 'Saving...' : 'Save edit'}</button>
              </div>
            </form>
          ) : (
            <p className="mt-1.5 whitespace-pre-line text-sm leading-5 text-slate-700 sm:mt-2.5 sm:text-[14px] sm:leading-6"><RichText text={post.content} /></p>
          )}

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
            {post.canEdit && !isEditing ? (
              <button type="button" onClick={() => { setEditedContent(post.content); setIsEditing(true); }} className="inline-flex items-center gap-1.5 hover:text-violet-700">
                <Pencil className="h-4 w-4" /> Edit
              </button>
            ) : null}
            {post.canReport ? (
              <button type="button" onClick={() => setIsReporting((current) => !current)} aria-expanded={isReporting} className="inline-flex items-center gap-1.5 hover:text-rose-700">
                <Flag className="h-4 w-4" /> Report
              </button>
            ) : null}
            {post.canDelete ? (
              <button type="button" onClick={() => void handleDelete()} disabled={isDeleting} className="ml-auto inline-flex items-center gap-1.5 text-rose-700 hover:text-rose-800 disabled:opacity-60">
                <Trash2 className="h-4 w-4" /> {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            ) : null}
          </div>

          {reportMessage ? <p role="status" className="mt-2 text-xs text-emerald-700">{reportMessage}</p> : null}
          {isReporting ? (
            <form onSubmit={handleReport} className="mt-3 space-y-2 rounded-xl border border-rose-200 bg-white p-3">
              <label className="block text-xs font-semibold text-slate-600">Reason
                <select value={reportReason} onChange={(event) => setReportReason(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500">
                  <option value="harassment">Harassment</option>
                  <option value="hate">Hate or discrimination</option>
                  <option value="spam">Spam</option>
                  <option value="explicit">Explicit content</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-600">Details (optional)
                <textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength={500} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500" />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsReporting(false)} className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600">Cancel</button>
                <button type="submit" disabled={isSubmittingReport} className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{isSubmittingReport ? 'Sending...' : 'Send report'}</button>
              </div>
            </form>
          ) : null}

          {error ? <p role="alert" className="mt-2 text-xs text-rose-600">{error}</p> : null}

          {isCommentsOpen ? (
            <section aria-label="Comments" className="mt-3 border-t border-slate-200 pt-3">
              {isCommentsLoading ? <p className="py-2 text-xs text-slate-500">Loading comments...</p> : null}
              {!isCommentsLoading && comments.length === 0 ? <p className="py-2 text-xs text-slate-500">No comments yet.</p> : null}
              <div className="space-y-3">
                {topLevelComments.map((comment) => (
                  <div key={comment.id} className="space-y-2">
                    <div className="flex items-start gap-2">
                      {comment.avatarUrl ? <Image src={comment.avatarUrl} alt="" width={28} height={28} unoptimized className="h-7 w-7 rounded-full object-cover" /> : null}
                      <div className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2">
                        <p className="text-xs font-semibold text-slate-800">
                          {comment.authorUsername ? (
                            <Link href={`/profile/${encodeURIComponent(comment.authorUsername)}`} className="hover:text-violet-700">{comment.authorName}</Link>
                          ) : comment.authorName}
                          <span className="ml-2 font-normal text-slate-400">{new Date(comment.createdAt).toLocaleString()}</span>
                        </p>
                        <p className="mt-1 whitespace-pre-line text-sm text-slate-700"><RichText text={comment.content} /></p>
                        <button type="button" onClick={() => startReply(comment)} className="mt-1 text-xs font-semibold text-violet-700 hover:underline">Reply</button>
                      </div>
                    </div>
                    {comments.filter((reply) => reply.parentCommentId === comment.id).map((reply) => (
                      <div key={reply.id} className="ml-8 flex items-start gap-2 border-l-2 border-violet-100 pl-2">
                        {reply.avatarUrl ? <Image src={reply.avatarUrl} alt="" width={24} height={24} unoptimized className="h-6 w-6 rounded-full object-cover" /> : null}
                        <div className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2">
                          <p className="text-xs font-semibold text-slate-800">
                            {reply.authorUsername ? <Link href={`/profile/${encodeURIComponent(reply.authorUsername)}`} className="hover:text-violet-700">{reply.authorName}</Link> : reply.authorName}
                            <span className="ml-2 font-normal text-slate-400">{new Date(reply.createdAt).toLocaleString()}</span>
                          </p>
                          <p className="mt-1 whitespace-pre-line text-sm text-slate-700"><RichText text={reply.content} /></p>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <form onSubmit={handleComment} className="mt-3 flex items-center gap-2">
                {replyTo ? <span className="text-xs text-slate-500">Replying to {replyTo.name}</span> : null}
                <input
                  ref={commentInputRef}
                  aria-label="Write a comment"
                  maxLength={500}
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  placeholder={replyTo ? `Reply to ${replyTo.name}...` : 'Write a comment...'}
                  className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500"
                />
                {replyTo ? <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="text-xs text-slate-500">Cancel</button> : null}
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
