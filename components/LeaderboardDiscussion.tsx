"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ImagePlus, MessageCircle, Send, X } from "lucide-react";
import { editLeaderboardComment, postLeaderboardComment } from "@/app/leaderboard-comment-actions";
import { MAX_MEDIA_BYTES } from "@/lib/leaderboard/media-limits";
import { commentDate } from "@/lib/leaderboard/comment-date";
import type { LeaderboardComment } from "@/lib/leaderboard/comments";
import { pageParams, type Cursor } from "@/lib/pagination";
import styles from "./LeaderboardDiscussion.module.css";

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
    if (selectedFile && selectedFile.size > MAX_MEDIA_BYTES) {
      setError("GIFs and stickers must be 3 MB or smaller.");
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
          <span className={styles.hint}>GIF, PNG or WebP · max 3 MB · attachments are public</span>
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

function CommentMessage({ comment, currentUserId }: { comment: LeaderboardComment; currentUserId: string }) {
  const router = useRouter();
  const [body, setBody] = useState(comment.body);
  const [draft, setDraft] = useState(comment.body);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await editLeaderboardComment(comment.id, draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const saved = draft.trim();
      setBody(saved);
      setDraft(saved);
      setEditing(false);
      router.refresh();
    } catch {
      setError("Could not save your comment. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {editing ? (
        <form id={`edit-form-${comment.id}`} onSubmit={save} className={styles.editForm}>
          <label className="sr-only" htmlFor={`edit-${comment.id}`}>Edit your comment</label>
          <textarea
            id={`edit-${comment.id}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={1000}
            required={!comment.media_url}
            rows={3}
            disabled={pending}
            className={styles.textarea}
          />
          <div className={styles.editActions}>
            <button type="submit" disabled={pending} className={styles.postButton}>
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              disabled={pending}
              className={styles.replyButton}
              onClick={() => { setDraft(body); setError(null); setEditing(false); }}
            >
              Cancel
            </button>
          </div>
          {error && <p role="alert" className={styles.error}>{error}</p>}
        </form>
      ) : body ? <p className={styles.bodyText}>{body}</p> : null}
      {comment.media_url && (
        <div className={comment.media_kind === "sticker" ? styles.sticker : styles.gif}>
          {/* Keep animated GIFs animated and display local preview data URLs. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={comment.media_url}
            alt={`${comment.media_kind === "gif" ? "GIF" : "Sticker"} posted by ${comment.display_name}`}
            loading="lazy" decoding="async" width={280} height={200}
          />
        </div>
      )}
      {comment.user_id === currentUserId && !editing && (
        <button
          type="button"
          className={styles.replyButton}
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
      )}
    </>
  );
}

function Comment({
  comment,
  currentUserId,
}: {
  comment: LeaderboardComment;
  currentUserId: string;
}) {
  const [replying, setReplying] = useState(false);
  const [replies, setReplies] = useState<LeaderboardComment[]>([]);
  const [nextCursor, setNextCursor] = useState<Cursor | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadReplies(reset = false) {
    setPending(true);
    setError(null);
    try {
      const params = pageParams(reset ? null : nextCursor);
      params.set("parent", comment.id);
      const response = await fetch(`/api/discussion?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load replies. Try again.");
      const page = await response.json();
      setReplies(previous => reset ? page.comments : [...previous, ...page.comments]);
      setNextCursor(page.nextCursor);
      setLoaded(true);
    } catch (error) { setError((error as Error).message); }
    finally { setPending(false); }
  }

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
          <CommentMessage comment={comment} currentUserId={currentUserId} />
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
      {(comment.reply_count ?? 0) > 0 && !loaded && <button type="button" className={styles.replyButton}
        disabled={pending} onClick={() => void loadReplies()}>{pending ? "Loading…" : `View ${comment.reply_count} replies`}</button>}
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
                <CommentMessage comment={reply} currentUserId={currentUserId} />
              </div>
            </li>
          ))}
        </ol>
      )}
      {loaded && nextCursor && <button type="button" className={styles.replyButton} disabled={pending}
        onClick={() => void loadReplies()}>{pending ? "Loading…" : "Load earlier replies"}</button>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {replying && (
        <div id={`reply-form-${comment.id}`} className={styles.replyForm}>
          <CommentComposer parentId={comment.id} onPosted={() => { setReplying(false); void loadReplies(true); }} />
        </div>
      )}
    </li>
  );
}

export function LeaderboardDiscussion({
  comments,
  error,
  currentUserId,
  nextCursor: initialCursor,
}: {
  comments: LeaderboardComment[];
  error: string | null;
  currentUserId: string;
  nextCursor: Cursor | null;
}) {
  const [topLevel, setThreads] = useState(comments);
  const [cursor, setCursor] = useState(initialCursor);
  const [pending, setPending] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  async function loadMore() {
    setPending(true);
    setPageError(null);
    try {
      const response = await fetch(`/api/discussion?${pageParams(cursor)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load comments. Try again.");
      const page = await response.json();
      setThreads(previous => [...previous, ...page.comments]);
      setCursor(page.nextCursor);
    } catch (error) { setPageError((error as Error).message); }
    finally { setPending(false); }
  }

  return (
    <section className={styles.section} aria-labelledby="discussion-title">
      <div className={styles.heading}>
        <div className={styles.headingIcon}><MessageCircle size={20} strokeWidth={1.8} aria-hidden="true" /></div>
        <div>
          <h2 id="discussion-title">The conversation</h2>
          <p>Talk through a problem, celebrate a win, or help someone keep going.</p>
        </div>
        {!error && <span className={styles.count}>{topLevel.length} threads loaded</span>}
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
                  currentUserId={currentUserId}
                />
              ))}
            </ol>
          )}
          {cursor && <button type="button" className="button-link secondary m-6" disabled={pending}
            onClick={() => void loadMore()}>{pending ? "Loading…" : "Load earlier threads"}</button>}
          {pageError && <p role="alert" className={styles.error}>{pageError}</p>}
        </>
      )}
    </section>
  );
}
