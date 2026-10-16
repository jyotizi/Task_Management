import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TaskDetail } from "@/components/TaskDetail";
import { apiFetch, getStoredUser } from "@/lib/api-client";
import type { ApiTask, ApiProjectMember, ApiComment } from "@/types";

vi.mock("@/lib/api-client", () => ({
  apiFetch: vi.fn(),
  getStoredUser: vi.fn(),
}));

const task: ApiTask = {
  id: "task-1",
  projectId: "project-1",
  title: "Write documentation",
  description: null,
  status: "todo",
  assigneeId: null,
  createdById: "user-1",
  position: 0,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const member: ApiProjectMember = {
  id: "membership-1",
  role: "member",
  user: { id: "user-1", name: "Meera Iyer", email: "meera@example.com" },
};

const comment: ApiComment = {
  id: "comment-1",
  author: member.user,
  body: "Please add a usage example.",
  createdAt: "2026-01-02T10:00:00Z",
};

function renderTaskDetail(members: ApiProjectMember[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TaskDetail task={task} projectId="project-1" members={members} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe("<TaskDetail /> comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStoredUser).mockReturnValue({
      id: "user-1",
      name: "Meera Iyer",
      email: "meera@example.com",
    });
  });

  it("loads and displays comments with their author", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ comments: [comment] } as never);

    renderTaskDetail([member]);

    const commentBody = await screen.findByText("Please add a usage example.");
    const commentArticle = commentBody.closest("article");
    expect(commentArticle).not.toBeNull();
    expect(within(commentArticle as HTMLElement).getByText("Meera Iyer")).toBeInTheDocument();
  });

  it("posts a comment as a project member", async () => {
    let posted = false;
    vi.mocked(apiFetch).mockImplementation((_path, options) => {
      if (options?.method === "POST") {
        posted = true;
        return Promise.resolve({ comment } as never);
      }
      return Promise.resolve({ comments: posted ? [comment] : [] } as never);
    });

    renderTaskDetail([member]);
    const input = await screen.findByRole("textbox", { name: "Write a comment" });
    fireEvent.change(input, { target: { value: "Please add a usage example." } });
    fireEvent.click(screen.getByRole("button", { name: "comment" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/api/tasks/task-1/comments", {
        method: "POST",
        body: JSON.stringify({ body: "Please add a usage example." }),
      });
    });
    expect(await screen.findByText("Please add a usage example.")).toBeInTheDocument();
  });

  it("shows comments but hides the composer for a viewer", async () => {
    vi.mocked(getStoredUser).mockReturnValue({
      id: "viewer-1",
      name: "Dev Viewer",
      email: "viewer@example.com",
    });
    vi.mocked(apiFetch).mockResolvedValue({ comments: [comment] } as never);
    const viewer: ApiProjectMember = {
      ...member,
      id: "membership-viewer",
      role: "viewer",
      user: { id: "viewer-1", name: "Dev Viewer", email: "viewer@example.com" },
    };

    renderTaskDetail([viewer]);

    expect(await screen.findByText("Please add a usage example.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Write a comment" })).not.toBeInTheDocument();
  });
});
