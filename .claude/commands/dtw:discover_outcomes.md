# Discovery Tree Workflow: Discover Outcomes

You are an orchestrating agent helping to discover outcomes from an external issue.

**Goal:** Transform an external issue (GitHub, Shortcut, etc.) into a Discovery Tree of outcome-focused beads.

## Your Task

1. **Fetch the external issue** (if URL provided) or work with user description
2. **Identify the user-facing outcome** (becomes the epic)
3. **Discover technical outcomes** (become beads) by asking:
   - "What outcomes do users need?"
   - "What should be true when this is done?"
   - "What can we verify independently?"
4. **Create the epic and beads** with proper structure

## Workflow

### Step 1: Understand the Goal

Read the external issue or discuss with the user to understand:
- What user value is being delivered?
- What problem is being solved?
- What constraints exist?

### Step 2: Create Epic

```bash
# Epic = User-facing outcome
bd create "Users can [do something valuable]" -t epic -p 1 --json
```

**Capture the epic ID for linking.**

### Step 3: Create Root Bead

```bash
# Root bead = Technical system outcome
bd create "[System] delivers [capability] [root]" -t task -p 1 --json
```

**Link to epic:**
```bash
bd dep add <root-bead-id> <epic-id> -t parent-child
```

### Step 4: Discover Outcome Beads

Have a 2-10 minute conversation to discover outcomes (NOT steps):

❌ **Avoid step thinking:**
- "Add validation to form"
- "Create API endpoint"
- "Write tests"

✅ **Think in outcomes:**
- "Invalid input shows clear error message"
- "API responds in <200ms for valid requests"
- "Edge cases fail safely without data loss"

**For each outcome:**

```bash
# Create outcome bead
bd create "Outcome description (what will be true)" -t task -p 1 --json

# Add context and acceptance criteria
bd update <bead-id> --description "
OUTCOME: [What will be true when done]

CONTEXT:
- Part of [epic/parent]
- Why this matters: [business/user value]
- External reference: [GitHub URL, etc.]

ACCEPTANCE:
- [ ] Criteria 1 (testable/verifiable)
- [ ] Criteria 2 (testable/verifiable)
- [ ] Criteria 3 (testable/verifiable)
"

# Link to root bead
bd dep add <outcome-bead-id> <root-bead-id> -t parent-child
```

### Step 5: Bead Sizing Check

For each bead, verify it's **agent-sized**:

✅ **Just right:**
- Agent-completable in one session
- Results in one PR
- Independently verifiable
- Has clear acceptance criteria

❌ **Too large:** Break down into smaller outcomes
❌ **Too small:** Combine or make a single commit

**The test:** Can an implementing agent deliver a mergeable PR in one session?

### Step 6: Summary

Show the tree structure:
```bash
bd dep tree <root-bead-id>
```

List ready work:
```bash
bd ready
```

**Explain to the user:**
- What epic was created
- What outcome beads are ready to implement
- Which bead(s) to start with
- How to spawn agents: `/dtw:spawn_agent <bead-id>`

## Key Principles

1. **Outcomes, not steps** - Describe what will be true, not how to make it true
2. **Just-in-time** - Don't plan everything upfront, discover as you go
3. **Agent-sized** - Each bead = one PR = one agent session
4. **Context-rich** - Include why this matters, not just what to do
5. **Verifiable** - Clear acceptance criteria for reviewing PRs

## Example

**External issue:** "Users are confused when login fails"

**Epic:**
```
Users can securely access their accounts
```

**Outcome beads:**
```
✅ User can sign in with valid email and password
✅ Invalid credentials show clear, secure error message
✅ Session persists for 30 days unless logged out
✅ Brute force attempts are rate-limited after 5 failures
```

Each bead has:
- Clear outcome (what will be true)
- Context (why it matters)
- Acceptance criteria (how to verify)

## Remember

- Ask clarifying questions if the external issue is vague
- Focus on outcomes, not implementation steps
- Make beads agent-sized (PR-sized)
- Add rich context and acceptance criteria
- Link everything properly (parent-child relationships)

**Next step after discovery:** Use `/dtw:spawn_agent <bead-id>` to implement outcomes.
