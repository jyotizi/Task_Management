# Django taskboard backend review

Ranked by business impact, with the highest impact first.

## 1. Search query permits SQL injection

- **File/lines:** `backend/projects/views.py:110–123` (SQL construction at 113–120)
- **Category:** Security
- **Severity:** Critical

The `q` query parameter is interpolated directly into SQL, so a crafted search can alter the query and expose or modify database data beyond the intended search. Replace this raw SQL with project-scoped ORM filters, for example `Task.objects.filter(project_id=project_id).filter(Q(title__icontains=q) | Q(description__icontains=q))`, and retain the ordering and serializer behavior.

## 2. Task updates have no membership or role check

- **File/lines:** `backend/projects/views.py:164–185` (`TaskDetailView.patch`)
- **Category:** Security / authorization
- **Severity:** Critical

Any authenticated caller who knows a task ID can change its title, status, description, or assignee, including callers outside the project and viewers. Load the task’s project membership and allow only `admin` or `member`, returning HTTP 403 otherwise; add a regression test asserting that a non-member’s PATCH is forbidden and the title remains unchanged.

**Test proof:** `backend/projects/tests.py` currently covers membership checks for deletion but has no PATCH authorization test. A safe regression proof should create a task and a non-member in an isolated test database, assert PATCH returns 403 and the original title remains, then clean up through the test transaction; this preserves seeded task data. I could not run the test here because Docker daemon access was denied, and no existing test proves this behavior.

## 3. Assignee IDs are not checked against project membership

- **File/lines:** `backend/projects/views.py:133–161` (`TaskListCreateView.post`) and `backend/projects/views.py:164–185` (`TaskDetailView.patch`, especially 180–182)
- **Category:** Data integrity
- **Severity:** High

Both create and update accept an arbitrary `assigneeId`, allowing assignment to a user who is not a project member; a malformed or nonexistent ID can raise a database error and return 500. Validate that a non-null assignee belongs to the task’s project before saving, allow null to clear the assignee, and return HTTP 400 for invalid or non-member IDs.

## 4. Task response fields use snake_case while the client expects camelCase

- **File/lines:** `backend/projects/serializers.py:6–25`
- **Category:** Data integrity / API contract
- **Severity:** High

The serializer emits `project_id`, `assignee_id`, and `created_by_id`, while the frontend task type and components use `projectId`, `assigneeId`, and `createdById`. The client can therefore fail to read the current assignee and submit an empty `assigneeId`, clearing assignments; explicitly map the response fields to the camelCase API names while preserving the model’s snake_case attributes internally.
