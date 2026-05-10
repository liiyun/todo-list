# Todo app roadmap

Rough feature ideas for the TODO app—use this to prioritize work and decide what ships next.

## Categories or tags

Let users organize todos by category (e.g. **work**, **personal**, **errands**).

- Add a `**category`** (or equivalent) column in persistence.
- Let users assign a category via tags or a picker.
- Show categories as **color-coded** labels on list items.
- Support **filtering** the list by category.

## Due dates

Add a due date per todo so users can see what is coming up.

- Add a `**due_date`** column (or equivalent).
- Use a **date picker** on the create (and optionally edit) form.
- **Display** the due date on each todo row.
- Consider **sorting** by due date and **emphasizing overdue** items.

## Priority levels

Let users mark completion urgency as **high**, **medium**, or **low**.

- Add a `**priority`** column with values such as `high` | `medium` | `low`.
- Add a **priority selector** on create/edit flows.
- Give high-priority rows **visual weight** (e.g. colored border or icon).
- Allow **sort** and/or **filter** by priority.

## Search and filter

Search the list and narrow by completion status **without requiring DB/schema changes**.

- Add a search field that **filters as you type** (client-side is fine).
- Add toggles or tabs for **all / active / completed**.
- Prefer **filtering in memory after fetch** if the dataset stays small.

## Better error handling

Make failures visible and predictable for users.

- Surface **readable error messages** in the UI instead of relying on the console alone.
- **Gracefully degrade** when the network or Supabase is unreachable (retry, fallback copy, retry action).
- **Validate** submit: reject empty strings and whitespace-only todo text before save.
- Show **loading** feedback (spinner or skeleton) while loading or mutating.

## More ideas

Nice-to-have UX improvements for later exploration.

- **Drag-and-drop** reorder.
- **Inline edit**—click a todo to edit text in place.
- **Undo delete** with a short-lived toast/action.
- **Keyboard shortcuts** for common actions.

