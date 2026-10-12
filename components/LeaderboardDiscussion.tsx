"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { MessageCircle, Send } from "lucide-react";
import { postLeaderboardComment } from "@/app/leaderboard-comment-actions";
import type { LeaderboardComment } from "@/lib/leaderboard/comments";
import styles from "./LeaderboardDiscussion.module.css";

function commentDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function CommentComposer({
  parentId,
  onPosted,
}: {
  parentId: string | null;
  onPosted?: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form).get("body");
    if (typeof body !== "string") return;
    setPending(true);
    setError(null);
    try {
      const result = await postLeaderboardComment(body, parentId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      formRef.current?.reset();
      onPosted?.();
      router.refresh();
    } catch {
      setError("Could not post your comment. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className={styles.composer}>
      <label className="sr-only" htmlFor={parentId ? `reply-${parentId}` : "new-comment"}>
        {parentId ? "Write a reply" : "Write a comment"}
      </label>
      <textarea
        id={parentId ? `reply-${parentId}` : "new-comment"}
        name="body"
        placeholder={parentId ? "Write a reply…" : "Share a thought, ask a question, or cheer someone on…"}
        maxLength={1000}
        minLength={1}
        rows={parentId ? 2 : 3}
        required
        disabled={pending}
        className={styles.textarea}
      />
      <div className={styles.composerFooter}>
        <span className={styles.hint}>Keep it constructive and kind.</span>
        <button type="submit" disabled={pending} className={styles.postButton}>
          <Send size={15} aria-hidden="true" />
          {pending ? "Posting…" : parentId ? "Post reply" : "Post comment"}
        </button>
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </form>
  );
}

function Comment({
  comment,
  replies,
  currentUserId,
}: {
  comment: LeaderboardComment;
  replies: LeaderboardComment[];
  currentUserId: string;
}) {
  const [replying, setReplying] = useState(false);

  return (
    <li className={styles.thread}>
      <div className={styles.comment}>
        <div className={styles.avatar} aria-hidden="true">
          {comment.display_name.trim().charAt(0).toUpperCase() || "P"}
        </div>
        <div className={styles.commentBody}>
          <div className={styles.meta}>
            <span className={styles.name}>{comment.display_name}</span>
            {comment.user_id === currentUserId && <span className={styles.you}>You</span>}
            <time dateTime={comment.created_at} className={styles.time}>{commentDate(comment.created_at)}</time>
          </div>
          <p className={styles.bodyText}>{comment.body}</p>
          <button
            type="button"
            className={styles.replyButton}
            onClick={() => setReplying((value) => !value)}
            aria-expanded={replying}
            aria-controls={replying ? `reply-form-${comment.id}` : undefined}
          >
            {replying ? "Cancel reply" : "Reply"}
          </button>
        </div>
      </div>
      {replies.length > 0 && (
        <ol className={styles.replies} aria-label={`Replies to ${comment.display_name}`}>
          {replies.map((reply) => (
            <li key={reply.id} className={styles.reply}>
              <div className={`${styles.avatar} ${styles.replyAvatar}`} aria-hidden="true">
                {reply.display_name.trim().charAt(0).toUpperCase() || "P"}
              </div>
              <div className={styles.commentBody}>
                <div className={styles.meta}>
                  <span className={styles.name}>{reply.display_name}</span>
                  {reply.user_id === currentUserId && <span className={styles.you}>You</span>}
                  <time dateTime={reply.created_at} className={styles.time}>{commentDate(reply.created_at)}</time>
                </div>
                <p className={styles.bodyText}>{reply.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {replying && (
        <div id={`reply-form-${comment.id}`} className={styles.replyForm}>
          <CommentComposer parentId={comment.id} onPosted={() => setReplying(false)} />
        </div>
      )}
    </li>
  );
}

export function LeaderboardDiscussion({
  comments,
  error,
  currentUserId,
}: {
  comments: LeaderboardComment[];
  error: string | null;
  currentUserId: string;
}) {
  const topLevel = comments.filter((comment) => comment.parent_id === null);
  const repliesByParent = new Map<string, LeaderboardComment[]>();
  for (const comment of comments) {
    if (!comment.parent_id) continue;
    const replies = repliesByParent.get(comment.parent_id) ?? [];
    replies.push(comment);
    repliesByParent.set(comment.parent_id, replies);
  }

  return (
    <section className={styles.section} aria-labelledby="discussion-title">
      <div className={styles.heading}>
        <div className={styles.headingIcon}><MessageCircle size={20} strokeWidth={1.8} aria-hidden="true" /></div>
        <div>
          <h2 id="discussion-title">The conversation</h2>
          <p>Talk through a problem, celebrate a win, or help someone keep going.</p>
        </div>
        {!error && <span className={styles.count}>{comments.length} {comments.length === 1 ? "comment" : "comments"}</span>}
      </div>
      {error ? (
        <p role="alert" className={styles.loadError}>{error}</p>
      ) : (
        <>
          <div className={styles.newComment}><CommentComposer parentId={null} /></div>
          {topLevel.length === 0 ? (
            <div className={styles.empty}>
              <MessageCircle size={22} strokeWidth={1.5} aria-hidden="true" />
              <p>Start the conversation.</p>
              <span>Your comment will appear here for everyone on the leaderboard.</span>
            </div>
          ) : (
            <ol className={styles.threads} aria-label="Leaderboard comments">
              {topLevel.map((comment) => (
                <Comment
                  key={comment.id}
                  comment={comment}
                  replies={repliesByParent.get(comment.id) ?? []}
                  currentUserId={currentUserId}
                />
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
