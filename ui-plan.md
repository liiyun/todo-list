# Plan: Build “The Philatelist” To-Do App UI

## 1. Product Concept

Build a task management interface where every to-do item feels like a physical collectible postage stamp. The product should move away from a conventional checklist UI and instead feel like a tactile vintage stamp album.

The user should feel like they are curating a collection, not managing chores.

Core experience:

- Tasks are collectible stamps.
- The task board is a sheet or album page of stamps.
- Completing a task feels like physically stamping it with red ink.
- Adding a task feels like pressing a wooden stamp into the page.
- The UI should feel analog, textural, archival, nostalgic, and satisfying.

---

## 2. Target UI Style

### Mood

Vintage postal archive meets dark-mode productivity app.

The interface should feel:

- tactile
- collectible
- analog
- nostalgic
- slightly worn
- premium
- focused
- calm rather than stressful

Avoid:

- generic SaaS cards
- flat list rows
- sterile minimalism
- bright neon colors
- overly clean modern dashboards

### Visual References

Use visual cues from:

- vintage postage stamps
- postal cancellation marks
- stamp album pages
- archival museum cards
- old transit/postal graphics
- aged paper
- rubber ink stamps
- typewriter labels
- brass fasteners and dark leather desk surfaces

---

## 3. Core Layout

### App Shell

The screen should use a dark charcoal background with subtle texture.

Recommended structure:

1. Header
2. User/account strip
3. “Stamp Press” new-task input area
4. Category/filter controls
5. Stamp grid
6. Small instruction/footer note

### Header

Replace the current “Todo List” title with:

```text
The Philatelist
A collection of important things
```

Header styling:

- Typewriter or slab serif display font
- warm ivory text
- optional postal cancellation mark beside the title
- small “EST. 2026” or similar decorative stamp mark

### Account Area

Current email/sign-out row should become a postal registry/passport-style strip.

Design:

- bordered capsule or ticket-like container
- dashed inner border
- email in monospace
- sign-out icon/button styled like a postal exit stamp or registry icon

---

## 4. New Task Input: “Stamp Press”

The new task form should feel like a physical stamping station.

### Layout

Use a large horizontal panel with dark aged metal/leather texture.

Inside it:

- left label card: “NEW STAMP”
- main task input as a torn paper or stamp-ticket field
- category dropdown
- priority dropdown
- due date picker
- large physical “ADD STAMP” button on the right

### Add Button

The Add button should look like a wooden-handled rubber stamp.

Visual details:

- carved wooden handle
- rubber base
- label on the base: `ADD STAMP`
- strong drop shadow
- press-down state on click

Interaction:

- On hover: slight lift
- On click: compress downward
- On successful add: newly created stamp drops into grid with a bounce animation

### Input Fields

Inputs should look like vintage postal form controls.

Use:

- dark field background
- muted brass/amber borders
- monospace type
- small postal icons
- subtle inner shadow
- slightly rounded corners

---

## 5. Task Grid: “Sheet of Stamps”

Replace the vertical task list with a responsive stamp grid.

### Desktop

- 3 columns preferred
- equal spacing
- stamps aligned like a collectible sheet

### Tablet

- 2 columns

### Mobile

- 1 column
- keep stamp aspect ratio

### Grid Behavior

- Cards should have slight rotation variance, very subtle only
- Hovering a stamp should lift it slightly
- Completed and overdue stamps should remain in the grid, not disappear

---

## 6. Task Stamp Component

Each task should be a vertical rectangular stamp card, approximately 3:4 ratio.

### Required Stamp Anatomy

Each stamp card must include:

1. Serrated/perforated edge
2. Category postmark in the top-left
3. Task number in the top-right
4. Large faint watermark illustration in the center
5. Task title centered in the body
6. Due date or denomination in the bottom-right
7. Hidden edit/delete actions revealed only on hover or long-press
8. Priority represented by stamp edge color

---

## 7. Serrated Stamp Border

The serrated edge is the most important motif.

Every task card must have a perforated postage-stamp border.

Implementation options:

### CSS Option A: Mask

Use CSS masks or `clip-path` to create a perforated edge.

### CSS Option B: Radial Gradient

Use repeated radial gradients around the edges to simulate stamp perforations.

### CSS Option C: SVG Wrapper

Create a reusable SVG border component with scalloped edges.

Recommended approach:

- Use a reusable `StampCard` component
- Use CSS pseudo-elements for serrated edge
- Keep the actual card content inside a clean inner frame

---

## 8. Stamp Surface Texture

Each stamp card should have a subtle paper texture.

Use:

- warm ivory or desaturated paper base
- light fiber texture overlay
- subtle stains/noise
- inner border line
- slightly worn corners

Suggested visual treatment:

```css
background:
  radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08), transparent 20%),
  linear-gradient(rgba(255,255,255,0.04), rgba(0,0,0,0.04)),
  #e8dcc3;
```

Also add noise via:

- CSS background image
- SVG noise filter
- generated texture asset
- subtle transparent PNG texture

---

## 9. Category System

Categories should be represented as postal postmarks.

### Work

Color: faded cyan / blue-green

Watermark icon options:

- fountain pen nib
- rotary phone
- typewriter
- drafting ruler

### Personal

Color: muted sage green

Watermark icon options:

- potted fern
- coffee mug
- book
- houseplant

### Groceries

Color: aged gold / ochre

Watermark icon options:

- wicker basket
- milk bottle
- bread loaf
- produce basket

### Postmark Style

Top-left badge should look like stamped ink:

- circular or wavy cancellation mark
- all-caps category text
- slight rotation
- distressed edge
- semi-transparent ink

---

## 10. Priority System

Priority should be communicated through the stamp border/perforation color.

### High Priority

- red serrated edge
- subtle red glow
- urgent but vintage, not neon

### Medium Priority

- amber/yellow serrated edge
- warm postal ink feel

### Low Priority

- slate-blue serrated edge
- calm faded ink feel

Use the priority color on:

- perforated edge
- inner stamp frame
- small accent marks

Do not use large modern priority pills.

---

## 11. Task Text Styling

Task titles should use a typewriter or monospace font.

Recommended fonts:

- Courier Prime
- IBM Plex Mono
- Special Elite
- JetBrains Mono
- American Typewriter-style fallback

Task title styling:

- centered
- black or dark brown ink
- slightly imperfect line height
- medium weight
- max 2–3 lines before truncation

---

## 12. Due Date / Denomination

The due date should look like a stamp denomination or postal date.

Examples:

```text
10-MAY
$05.10
5¢
MAY 10
```

Location:

- bottom-right corner

Styling:

- small monospace
- category/priority ink color
- slightly faded

---

## 13. Completion Interaction

Remove the standard checkbox entirely.

### Interaction

Clicking or tapping a stamp completes the task.

On completion:

- A large red ink stamp slams onto the card
- Text says `DONE`, `PAID`, or `POSTED`
- Stamp is semi-transparent red
- Slight rotation, around -10 to -15 degrees
- Fast downward motion with bounce
- Optional subtle screen shake or paper compression

### Completed Visual State

Completed stamp should:

- remain visible
- become slightly faded/desaturated
- show the red overlay stamp
- have muted contrast

Completion should feel satisfying and physical.

---

## 14. Overdue State

Overdue tasks should look weathered, faded, and slightly damaged.

Visual effects:

- faded paper
- red edge glow or pulse
- darker stains
- slight crease texture
- border appears worn

Animation:

- subtle red border pulse
- keep slow and restrained

Do not use aggressive alert banners.

---

## 15. Edit/Delete Actions

Edit and delete controls should be hidden by default.

Reveal on:

- hover for desktop
- long-press or overflow button for touch devices
- keyboard focus for accessibility

Visual style:

- small postal utility controls
- edit icon can be fountain pen/nib
- delete icon can be wax seal, postal cancellation, or small red stamp

Placement:

- lower-left or lower-right overlay
- should not dominate the collectible card design

---

## 16. Filters and Sorting

Add a small filter row above the grid.

Controls:

- All Stamps
- Work
- Personal
- Groceries
- Sort by Due Date / Priority / Created

Style:

- postal registry buttons
- stamp-like badges
- brass outline
- small icons
- active state appears like inked selection

---

## 17. Animation Requirements

Use motion sparingly but meaningfully.

Recommended library:

- Framer Motion if using React

### Animations

#### Add Task

- New stamp drops into grid
- slight bounce
- shadow lands underneath

#### Complete Task

- red stamp overlay slams down
- opacity snaps in
- minor rotation

#### Hover Stamp

- lift 4–8px
- shadow deepens
- optional slight straighten rotation

#### Overdue Pulse

- red edge glows softly
- slow loop

#### Form Button Press

- wooden stamp compresses downward
- shadow contracts

---

## 18. Color Palette

### Base

```css
--bg: #121214;
--panel: #1a1a1d;
--panel-2: #1E1E20;
--paper: #E8DCC3;
--paper-aged: #D8C8A7;
--ink-dark: #1F1A14;
--ink-muted: #6F6656;
```

### Category Inks

```css
--work: #5FA9B0;       /* faded cyan */
--personal: #8FA27A;   /* muted sage */
--groceries: #C79A3B;  /* aged gold */
```

### Priority

```css
--priority-high: #B84A42;
--priority-medium: #C89B3C;
--priority-low: #5A7D91;
```

### Completion

```css
--done-red: rgba(239, 68, 68, 0.70);
```

### Lines / Hardware

```css
--brass: #A47A3C;
--border-muted: rgba(232, 220, 195, 0.22);
--shadow: rgba(0, 0, 0, 0.45);
```

---

## 19. Typography

### Heading

Use a vintage typewriter/slab display style.

Recommended:

- Special Elite
- Courier Prime
- Rye
- Eczar
- IBM Plex Mono

### Body/UI

- IBM Plex Mono
- Courier Prime
- JetBrains Mono

### Rules

- Avoid modern geometric SaaS typography for primary visual identity
- Use uppercase for labels and postmarks
- Use generous letter spacing on metadata

---

## 20. Component Architecture

Suggested React component structure:

```text
src/
  app/
    page.tsx
  components/
    AppShell.tsx
    Header.tsx
    AccountRegistry.tsx
    StampPressForm.tsx
    StampGrid.tsx
    StampCard.tsx
    CategoryPostmark.tsx
    StampWatermark.tsx
    CompletionStamp.tsx
    FilterBar.tsx
    SortControl.tsx
    IconButton.tsx
  lib/
    task-types.ts
    task-utils.ts
    date-utils.ts
  styles/
    globals.css
    stamp.css
```

---

## 21. Data Model

Use a task object like this:

```ts
export type TaskCategory = 'work' | 'personal' | 'groceries';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  category: TaskCategory;
  priority: TaskPriority;
  dueDate: string; // ISO date
  completed: boolean;
  createdAt: string;
}
```

Derived helpers:

```ts
isOverdue(task): boolean
formatStampDate(date): string
getCategoryInk(category): string
getPriorityInk(priority): string
getWatermarkIcon(category): IconName
```

---

## 22. Initial Demo Data

Use seed data that matches the visual concept:

```ts
const initialTasks = [
  {
    id: '1',
    title: 'Design quarterly report',
    category: 'work',
    priority: 'low',
    dueDate: '2026-05-10',
    completed: false,
    createdAt: '2026-05-01'
  },
  {
    id: '2',
    title: 'Buy groceries for the week',
    category: 'groceries',
    priority: 'medium',
    dueDate: '2026-05-11',
    completed: false,
    createdAt: '2026-05-02'
  },
  {
    id: '3',
    title: 'Call with design team',
    category: 'work',
    priority: 'low',
    dueDate: '2026-05-02',
    completed: true,
    createdAt: '2026-04-28'
  },
  {
    id: '4',
    title: 'Submit project proposal',
    category: 'work',
    priority: 'high',
    dueDate: '2026-05-01',
    completed: false,
    createdAt: '2026-04-25'
  },
  {
    id: '5',
    title: 'Water the plants',
    category: 'personal',
    priority: 'low',
    dueDate: '2026-05-12',
    completed: false,
    createdAt: '2026-05-03'
  },
  {
    id: '6',
    title: 'Pick up milk & bread',
    category: 'groceries',
    priority: 'medium',
    dueDate: '2026-05-14',
    completed: false,
    createdAt: '2026-05-04'
  }
];
```

---

## 23. Important UI Details

### Stamp Number

Each card should show a task number:

```text
No. 001
No. 002
No. 003
```

### Footer Hint

At bottom of grid:

```text
Tap a stamp to complete it
Long press for more options
```

### Empty State

If no tasks exist:

Show an empty album page with text:

```text
No stamps in the album yet.
Press a new task into the collection.
```

### Loading State

Use skeleton stamp silhouettes rather than generic loading bars.

---

## 24. Accessibility Requirements

Even though the UI is decorative, it must remain usable.

Requirements:

- Stamp cards are keyboard-focusable buttons or contain accessible buttons
- Completion action has clear aria-label
- Edit/delete buttons appear on keyboard focus, not only hover
- Color must not be the only priority indicator; include accessible labels
- Maintain sufficient contrast for text on paper
- Respect reduced motion preferences
- Form fields have visible labels
- Add button must have text label, not icon only

Reduced motion behavior:

- Replace stamp slam animation with a simple fade/scale
- Disable pulsing overdue border
- Keep hover transitions minimal

---

## 25. Responsive Behavior

### Desktop

- Full stamp press panel
- 3-column grid
- hover interactions enabled

### Tablet

- 2-column grid
- form controls wrap
- add stamp button remains large

### Mobile

- 1-column grid
- form stacks vertically
- edit/delete accessible through visible small overflow button or long press
- stamp cards should remain large enough to feel tactile

---

## 26. Suggested Tech Stack

Assuming Cursor is building a modern frontend:

Recommended:

- Next.js or Vite React
- TypeScript
- Tailwind CSS
- Framer Motion
- lucide-react icons
- localStorage persistence for initial version

Optional:

- shadcn/ui only for primitives if restyled heavily
- CSS modules for stamp-specific effects
- SVG icons/custom illustrations for watermark assets

---

## 27. Persistence

For the first build, use localStorage.

Store:

```text
philatelist_tasks
```

Actions:

- add task
- complete/uncomplete task
- edit task
- delete task
- filter by category
- sort by due date, priority, created date

---

## 28. Interaction Specs

### Add Task Flow

1. User types task title
2. Selects category
3. Selects priority
4. Selects due date
5. Presses ADD STAMP
6. Button depresses
7. New stamp appears in grid with drop/bounce animation
8. Form resets

### Complete Task Flow

1. User taps/clicks stamp
2. Stamp overlay appears with slam animation
3. Task is marked complete
4. Card becomes faded but remains in place

### Edit Task Flow

1. User hovers/focuses/long-presses stamp
2. Edit/delete controls appear
3. Edit opens inline or modal editor
4. Save returns card to grid

### Delete Task Flow

1. User reveals delete control
2. Confirmation is optional for demo; recommended for production
3. Card fades/shrinks out of grid

---

## 29. Visual Implementation Notes

### Creating the Stamp Perforation

A practical CSS approach:

- Outer wrapper controls perforation color
- Inner content has paper background
- Use pseudo-elements or SVG mask for punched edges

Example conceptual structure:

```tsx
<div className="stamp stamp--priority-high">
  <div className="stamp__paper">
    <CategoryPostmark />
    <StampWatermark />
    <h3>{task.title}</h3>
    <span>{formattedDate}</span>
  </div>
</div>
```

### Layering

Use these layers inside a stamp:

1. serrated edge layer
2. aged paper layer
3. fiber/noise layer
4. inner border layer
5. watermark illustration
6. metadata text
7. task title
8. completion stamp overlay
9. hidden action buttons

---

## 30. Cursor Build Instructions

Cursor should implement this as a polished interactive frontend, not just a static mockup.

Build priorities:

1. Create the dark vintage app shell
2. Build the stamp card component with serrated edge
3. Convert tasks into a responsive stamp grid
4. Build the stamp press form
5. Add completion stamp animation
6. Add category filters and sorting
7. Add localStorage persistence
8. Add responsive polish
9. Add accessibility details
10. Refine texture, typography, and motion

---

## 31. Definition of Done

The build is complete when:

- The UI no longer looks like a standard todo list
- Tasks appear as collectible postage stamps
- There is a responsive 1/2/3-column stamp grid
- Every stamp has a serrated edge
- Categories appear as postmarks
- Priority is shown through border color
- Completed tasks receive a large red `DONE` stamp overlay
- Overdue tasks look weathered and urgent
- The add form feels like a stamp press station
- Edit/delete controls are hidden until needed
- The app works with keyboard and screen readers
- Tasks persist after refresh
- The visual language matches the generated Philatelist mockup

---

## 32. Final Creative Direction

Make the product feel like a small analog object inside the browser.

The key design sentence:

> This should feel less like checking off chores and more like pressing, sorting, and collecting beautiful vintage stamps.

Every visual and interaction decision should support that feeling.
