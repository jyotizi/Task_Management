import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, getStoredUser } from "@/lib/api-client";
import type { ApiComment, ApiTask, ApiProjectMember, TaskStatus } from "@/types";
import { STATUS_LABELS, STATUS_ORDER } from "@/types";

type Props = {
  task: ApiTask;
  projectId: string;
  members: ApiProjectMember[];
  onClose: () => void;
};

export function TaskDetail({ task, projectId, members, onClose }: Props) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [assigneeId, setAssigneeId] = useState<string>(task.assigneeId ?? "");
  const [commentBody, setCommentBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const currentUser = getStoredUser();
  const currentMembership = members.find((member) => member.user.id === currentUser?.id);
  const canComment = currentMembership?.role === "admin" || currentMembership?.role === "member";

  const commentsQuery = useQuery({
    queryKey: ["task-comments", task.id],
    queryFn: () => apiFetch<{ comments: ApiComment[] }>(`/api/tasks/${task.id}/comments`),
  });

  const updateTask = useMutation({
    mutationFn: (input: Partial<ApiTask>) =>
      apiFetch<{ task: ApiTask }>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "save failed"),
  });

  const deleteTask = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: true }>(`/api/tasks/${task.id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "delete failed"),
  });

  const createComment = useMutation({
    mutationFn: (body: string) =>
      apiFetch<{ comment: ApiComment }>(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => {
      setCommentBody("");
      queryClient.invalidateQueries({ queryKey: ["task-comments", task.id] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "comment failed"),
  });

  function onSave() {
    setError(null);
    updateTask.mutate({
      title,
      description,
      status,
      assigneeId: assigneeId || null,
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center px-4 z-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-surface border border-border rounded-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">edit task</h2>
          <button onClick={onClose} className="text-muted hover:text-white">
            ✕
          </button>
        </div>

        <label className="block mb-3">
          <span className="text-xs text-muted">title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full rounded-md bg-bg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </label>

        <label className="block mb-3">
          <span className="text-xs text-muted">description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="mt-1 block w-full rounded-md bg-bg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </label>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <label className="block">
            <span className="text-xs text-muted">status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="mt-1 block w-full rounded-md bg-bg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-muted">assignee</span>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="mt-1 block w-full rounded-md bg-bg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              <option value="">unassigned</option>
              {members.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <section className="border-t border-border pt-4 mb-4" aria-label="Task comments">
          <h3 className="text-sm font-semibold mb-3">comments</h3>
          {commentsQuery.isLoading && <p className="text-sm text-muted">loading comments…</p>}
          {commentsQuery.isError && <p className="text-sm text-red-400">could not load comments</p>}
          {commentsQuery.data?.comments.length === 0 && (
            <p className="text-sm text-muted">no comments yet</p>
          )}
          <div className="space-y-3 mb-4">
            {commentsQuery.data?.comments.map((comment) => (
              <article key={comment.id} className="rounded-md bg-bg border border-border p-3">
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <span className="text-sm font-medium">{comment.author.name}</span>
                  <time className="text-xs text-muted" dateTime={comment.createdAt}>
                    {new Date(comment.createdAt).toLocaleString()}
                  </time>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">{comment.body}</p>
              </article>
            ))}
          </div>
          {canComment && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (commentBody.trim()) createComment.mutate(commentBody);
              }}
              className="flex items-start gap-2"
            >
              <textarea
                aria-label="Write a comment"
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
                rows={2}
                placeholder="write a comment…"
                className="min-w-0 flex-1 rounded-md bg-bg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                disabled={!commentBody.trim() || createComment.isPending}
                className="text-sm px-3 py-2 rounded-md bg-accent text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {createComment.isPending ? "posting…" : "comment"}
              </button>
            </form>
          )}
        </section>

        {error && (
          <p className="text-sm text-red-400 mb-3" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => deleteTask.mutate()}
            disabled={deleteTask.isPending}
            className="text-sm text-red-400 hover:text-red-300"
          >
            delete task
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-sm px-4 py-2 rounded-md border border-border hover:border-muted"
            >
              cancel
            </button>
            <button
              onClick={onSave}
              disabled={updateTask.isPending}
              className="text-sm px-4 py-2 rounded-md bg-accent text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {updateTask.isPending ? "saving…" : "save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
