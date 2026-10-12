"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ImagePlus, MessageCircle, Send, X } from "lucide-react";
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
  const fileRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function chooseFile(file: File | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = file ? URL.createObjectURL(file) : null;
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setSelectedFile(file);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (selectedFile && selectedFile.size > 5 * 1024 * 1024) {
      setError("GIFs and stickers must be 5 MB or smaller.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await postLeaderboardComment(new FormData(form), parentId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      formRef.current?.reset();
      chooseFile(null);
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
        required={!selectedFile}
        rows={parentId ? 2 : 3}
        disabled={pending}
        className={styles.textarea}
      />
      {selectedFile && previewUrl && (
        <div className={styles.attachmentPreview}>
          {/* Native img preserves animation and blob previews without an image proxy. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Selected attachment preview" />
          <div>
            <span>{selectedFile.type === "image/gif" || /\.gif$/i.test(selectedFile.name) ? "GIF" : "Sticker"} ready to post</span>
            <small>{selectedFile.name}</small>
          </div>
          <button
            type="button"
            onClick={() => { chooseFile(null); if (fileRef.current) fileRef.current.value = ""; }}
            className={styles.removeAttachment}
            aria-label="Remove attachment"
            disabled={pending}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
      <div className={styles.composerFooter}>
        <div className={styles.attachmentControls}>
          <input
            ref={fileRef}
            id={parentId ? `media-${parentId}` : "new-comment-media"}
            name="media"
            type="file"
            aria-label="Add GIF or sticker"
            accept="image/gif,image/png,image/webp,.gif,.png,.webp"
            onChange={(event) => { chooseFile(event.target.files?.[0] ?? null); setError(null); }}
            disabled={pending}
            className="sr-only"
          />
          <label htmlFor={parentId ? `media-${parentId}` : "new-comment-media"} className={styles.attachButton}>
            <ImagePlus size={16} aria-hidden="true" />
            <span className={styles.attachLong}>Add GIF or sticker</span>
            <span className={styles.attachShort}>Attach</span>
          </label>
          <span className={styles.hint}>GIF, PNG or WebP · max 5 MB</span>
        </div>
        <button type="submit" disabled={pending} className={styles.postButton}>
          <Send size={15} aria-hidden="true" />
          {pending ? "Posting…" : parentId ? "Post reply" : "Post comment"}
        </button>
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </form>
  );
}

function CommentMessage({ comment }: { comment: LeaderboardComment }) {
  return (
    <>
      {comment.body && <p className={styles.bodyText}>{comment.body}</p>}
      {comment.media_url && (
        <div className={comment.media_kind === "sticker" ? styles.sticker : styles.gif}>
          {/* Keep animated GIFs animated and display local preview data URLs. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={comment.media_url}
            alt={`${comment.media_kind === "gif" ? "GIF" : "Sticker"} posted by ${comment.display_name}`}
          />
        </div>
      )}
    </>
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
          <CommentMessage comment={comment} />
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
                <CommentMessage comment={reply} />
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
