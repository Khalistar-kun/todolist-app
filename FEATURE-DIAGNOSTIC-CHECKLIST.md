# Feature Diagnostic Checklist

This document helps systematically test all features in the todolist application.

## How to Use
1. Go through each section
2. Test the feature in the UI
3. Mark [✓] if working, [✗] if broken, [?] if unclear
4. Add notes for any issues found

---

## 1. Slack Integration

### Test 1: Task Creation Notification
- [ ] Create a new task in a project
- [ ] Check if Slack notification is sent to configured channel
- **Expected**: "🆕 New Task Created" message in Slack
- **Notes**: _______________________________________

### Test 2: Task Movement Notification (FIXED)
- [ ] Move a task from one stage to another (drag & drop)
- [ ] Check if Slack receives notification with "Task moved" message
- **Expected**: Message shows "From: [stage] → To: [stage]" with user name
- **Notes**: _______________________________________

### Test 3: Task Update Notification
- [ ] Update task title, description, or priority
- [ ] Check if Slack receives "✏️ Task Updated" notification
- **Expected**: Update notification in Slack
- **Notes**: _______________________________________

### Test 4: Task Deletion Notification
- [ ] Delete a task
- [ ] Check if Slack receives "🗑️ Task Deleted" notification
- **Expected**: Deletion notification in Slack
- **Notes**: _______________________________________

### Setup Check
Run this SQL to verify Slack is configured:
```sql
SELECT
  project_id,
  access_token IS NOT NULL as has_token,
  channel_id,
  channel_name,
  notify_on_task_create,
  notify_on_task_update,
  notify_on_task_delete,
  notify_on_task_move,
  notify_on_task_complete
FROM slack_integrations
WHERE project_id = 'YOUR_PROJECT_ID';
```

---

## 2. Mentions System

### Test 1: Mention Autocomplete
- [ ] Open task modal and click to add a comment
- [ ] Type `@` followed by a team member's name
- [ ] Verify autocomplete dropdown appears with matching users
- **Expected**: Dropdown shows project members with avatars
- **Notes**: _______________________________________

### Test 2: Mention Notification
- [ ] Type `@username` in a comment and post it
- [ ] Check if mentioned user receives notification
- [ ] Check inbox for "You were mentioned" notification
- **Expected**: Notification appears in user's inbox with high priority
- **Notes**: _______________________________________

### Test 3: Mention in Attention Inbox
- [ ] After being mentioned, check the Attention Inbox (bell icon)
- [ ] Verify mention appears with context
- **Expected**: "👤 mentioned you" item with comment preview
- **Notes**: _______________________________________

### Test 4: Multiple Mentions
- [ ] Post comment with multiple mentions: "@user1 and @user2 please review"
- [ ] Verify both users receive separate notifications
- **Expected**: Both users get notified independently
- **Notes**: _______________________________________

### Database Check
Run this to see if mentions are being created:
```sql
SELECT
  m.id,
  m.mention_context,
  m.created_at,
  p1.full_name as mentioned_user,
  p2.full_name as mentioner
FROM mentions m
JOIN profiles p1 ON m.mentioned_user_id = p1.id
JOIN profiles p2 ON m.mentioner_user_id = p2.id
ORDER BY m.created_at DESC
LIMIT 10;
```

---

## 3. Subtasks

### Test 1: Create Subtask
- [ ] Open a task modal
- [ ] Scroll to "Subtasks" section
- [ ] Click "Add Subtask" and enter a title
- [ ] Save the subtask
- **Expected**: Subtask appears in the list under the task
- **Notes**: _______________________________________

### Test 2: Complete Subtask
- [ ] Click the checkbox next to a subtask
- [ ] Verify it marks as complete
- **Expected**: Subtask shows checkmark, strikethrough text
- **Notes**: _______________________________________

### Test 3: Edit Subtask
- [ ] Click on subtask title to edit
- [ ] Change the title and save
- **Expected**: Subtask title updates
- **Notes**: _______________________________________

### Test 4: Delete Subtask
- [ ] Click delete/trash icon on subtask
- [ ] Confirm deletion
- **Expected**: Subtask is removed from list
- **Notes**: _______________________________________

### Test 5: Subtask Progress
- [ ] Create task with 3 subtasks
- [ ] Complete 2 of them
- [ ] Check if progress shows "2/3 completed"
- **Expected**: Progress indicator updates correctly
- **Notes**: _______________________________________

### Database Check
```sql
SELECT
  st.id,
  st.title,
  st.completed,
  st.assigned_to,
  t.title as parent_task_title
FROM subtasks st
JOIN tasks t ON st.task_id = t.id
WHERE t.project_id = 'YOUR_PROJECT_ID'
ORDER BY st.created_at DESC
LIMIT 20;
```

---

## 4. Task Dependencies

### Test 1: Add Dependency
- [ ] Open task modal
- [ ] Go to "Dependencies" section
- [ ] Add a task as a blocker/dependency
- **Expected**: Dependency appears in the list
- **Notes**: _______________________________________

### Test 2: Dependency Validation
- [ ] Try to complete a task that has incomplete dependencies
- **Expected**: Warning message or blocked from completing
- **Notes**: _______________________________________

### Test 3: View Dependency Graph
- [ ] Navigate to project dependencies view
- [ ] Check if dependencies are visualized
- **Expected**: Visual graph showing task relationships
- **Notes**: _______________________________________

---

## 5. Task Approval Workflow

### Test 1: Submit for Approval
- [ ] Move task to "Done" stage
- [ ] Check if task shows "Pending Approval" status
- **Expected**: Task requires owner/admin approval
- **Notes**: _______________________________________

### Test 2: Approve Task
- [ ] As project owner/admin, approve the pending task
- [ ] Verify task is marked as completed
- **Expected**: Task moves to "Approved" state, counts toward completion
- **Notes**: _______________________________________

### Test 3: Reject Task
- [ ] As owner/admin, reject a pending task
- [ ] Provide rejection reason
- **Expected**: Task returns to previous stage with rejection note
- **Notes**: _______________________________________

---

## 6. Recurring Tasks

### Test 1: Create Recurring Task
- [ ] Create task with recurrence pattern (daily/weekly/monthly)
- [ ] Save the task
- **Expected**: Recurrence settings are saved
- **Notes**: _______________________________________

### Test 2: Auto-Generate Next Instance
- [ ] Complete a recurring task
- [ ] Check if next instance is automatically created
- **Expected**: New task appears with next due date
- **Notes**: _______________________________________

---

## 7. Time Tracking

### Test 1: Start Timer
- [ ] Open task modal
- [ ] Click "Start Timer" button
- [ ] Verify timer is running
- **Expected**: Timer shows elapsed time
- **Notes**: _______________________________________

### Test 2: Stop Timer and Log Time
- [ ] Stop the timer after some time
- [ ] Verify time is logged to the task
- **Expected**: Time entry appears in task history
- **Notes**: _______________________________________

### Test 3: Manual Time Entry
- [ ] Add manual time entry
- [ ] Enter hours/minutes worked
- **Expected**: Time is recorded
- **Notes**: _______________________________________

---

## 8. Milestones

### Test 1: Create Milestone
- [ ] Go to project settings or milestones section
- [ ] Create a new milestone with due date
- **Expected**: Milestone is created
- **Notes**: _______________________________________

### Test 2: Assign Tasks to Milestone
- [ ] Edit task and assign it to a milestone
- **Expected**: Task is linked to milestone
- **Notes**: _______________________________________

### Test 3: Milestone Progress
- [ ] View milestone
- [ ] Check if progress percentage is shown
- **Expected**: Shows X% complete based on linked tasks
- **Notes**: _______________________________________

---

## 9. Workload View

### Test 1: View Team Workload
- [ ] Navigate to Workload view
- [ ] Check if team members are listed with task counts
- **Expected**: Each member shows assigned tasks and workload
- **Notes**: _______________________________________

### Test 2: Filter by Time Period
- [ ] Filter workload by week/month
- **Expected**: View updates to show tasks for selected period
- **Notes**: _______________________________________

---

## 10. Reporting Dashboard

### Test 1: View Project Stats
- [ ] Open reporting dashboard
- [ ] Check if charts and stats are displayed
- **Expected**: Shows task completion, velocity, burndown, etc.
- **Notes**: _______________________________________

### Test 2: Export Report
- [ ] Click export button
- [ ] Choose CSV or PDF format
- **Expected**: Report downloads successfully
- **Notes**: _______________________________________

---

## 11. Portfolio Dashboard

### Test 1: View All Projects
- [ ] Navigate to portfolio dashboard
- [ ] Check if all projects are listed
- **Expected**: Shows projects with completion percentages
- **Notes**: _______________________________________

### Test 2: Cross-Project Analytics
- [ ] View cross-project metrics
- **Expected**: Aggregated stats across all projects
- **Notes**: _______________________________________

---

## 12. My Tasks View

### Test 1: See All Assigned Tasks
- [ ] Go to "My Tasks" view
- [ ] Verify all tasks assigned to you are shown
- **Expected**: List of tasks across all projects
- **Notes**: _______________________________________

### Test 2: Filter by Status
- [ ] Filter tasks by "In Progress", "Done", etc.
- **Expected**: View updates with filtered tasks
- **Notes**: _______________________________________

---

## 13. Attention Inbox

### Test 1: View Inbox
- [ ] Click bell icon to open Attention Inbox
- [ ] Check if notifications appear
- **Expected**: Shows mentions, assignments, due tasks
- **Notes**: _______________________________________

### Test 2: Mark as Read
- [ ] Click on an inbox item to mark as read
- **Expected**: Item is marked read, unread count decreases
- **Notes**: _______________________________________

### Test 3: Dismiss Items
- [ ] Dismiss an inbox item
- **Expected**: Item is removed from inbox
- **Notes**: _______________________________________

---

## 14. Voice Input

### Test 1: Create Task via Voice
- [ ] Click voice input button
- [ ] Speak task details
- **Expected**: Speech is transcribed and task is created
- **Notes**: _______________________________________

### Test 2: Edit Task via Voice
- [ ] Use voice input to update task description
- **Expected**: Voice is transcribed and task updates
- **Notes**: _______________________________________

---

## 15. AI Features (Groq)

### Test 1: AI Task Analysis
- [ ] Click "AI Assist" button on a task
- [ ] Select "Analyze Task"
- **Expected**: AI provides insights, priorities, suggestions
- **Notes**: _______________________________________

### Test 2: AI Task Breakdown
- [ ] Use "Break Down Task" AI feature
- [ ] Check if subtasks are suggested
- **Expected**: AI suggests multiple subtasks
- **Notes**: _______________________________________

### Test 3: AI Natural Language Task Creation
- [ ] Type natural language: "remind me to call john tomorrow at 3pm"
- [ ] Use AI to parse and create task
- **Expected**: Task created with correct title, due date, etc.
- **Notes**: _______________________________________

### Test 4: AI Acceptance Criteria
- [ ] Use "Generate Acceptance Criteria" feature
- [ ] Check if Given/When/Then criteria are generated
- **Expected**: Well-formed acceptance criteria appear
- **Notes**: _______________________________________

### Environment Check
```bash
# Check if GROQ_API_KEY is set
echo $GROQ_API_KEY  # Linux/Mac
echo %GROQ_API_KEY%  # Windows CMD
$env:GROQ_API_KEY  # Windows PowerShell
```

---

## 16. Comments

### Test 1: Add Comment
- [ ] Open task modal
- [ ] Add a comment
- **Expected**: Comment appears in activity feed
- **Notes**: _______________________________________

### Test 2: Edit Comment
- [ ] Edit an existing comment
- **Expected**: Comment updates with "edited" indicator
- **Notes**: _______________________________________

### Test 3: Delete Comment
- [ ] Delete a comment
- **Expected**: Comment is removed
- **Notes**: _______________________________________

---

## 17. Activity Logs

### Test 1: View Activity Feed
- [ ] Open task modal
- [ ] Check activity/history tab
- **Expected**: Shows all changes to task
- **Notes**: _______________________________________

### Test 2: Activity Entries
- [ ] Verify entries show: who, what, when
- **Expected**: "User X changed status from Y to Z at [time]"
- **Notes**: _______________________________________

---

## 18. Tags

### Test 1: Add Tag
- [ ] Add a tag to a task
- **Expected**: Tag appears on task card
- **Notes**: _______________________________________

### Test 2: Filter by Tag
- [ ] Click a tag to filter tasks
- **Expected**: Only tasks with that tag are shown
- **Notes**: _______________________________________

---

## 19. Search

### Test 1: Search Tasks
- [ ] Use search bar to find a task by title
- **Expected**: Matching tasks appear in results
- **Notes**: _______________________________________

### Test 2: Advanced Search
- [ ] Search with filters (assignee, status, tags)
- **Expected**: Results match all criteria
- **Notes**: _______________________________________

---

## 20. Notifications

### Test 1: Browser Notifications
- [ ] Enable browser notifications
- [ ] Trigger an event (mention, assignment, etc.)
- **Expected**: Browser notification appears
- **Notes**: _______________________________________

---

## Summary of Issues Found

### Critical Issues
1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

### Medium Issues
1. ___________________________________________
2. ___________________________________________

### Minor Issues
1. ___________________________________________
2. ___________________________________________

---

## Next Steps

Based on test results, prioritize fixes in this order:
1. [ ] ___________________________________________
2. [ ] ___________________________________________
3. [ ] ___________________________________________

---

**Test Date**: _______________________
**Tested By**: _______________________
**Environment**: Development / Staging / Production
