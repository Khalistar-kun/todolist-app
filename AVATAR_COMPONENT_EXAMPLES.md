# Avatar System - Component Examples

## UserAvatar Component

### Basic Usage
```tsx
import UserAvatar from '@/components/Avatar'

// Simple avatar with default size (32px)
<UserAvatar email="john@example.com" />
```

### With Custom Avatar
```tsx
// Using uploaded image
<UserAvatar
  email="jane@example.com"
  avatarUrl="https://example.com/avatars/jane.jpg"
  size={48}
/>

// Using predefined avatar
<UserAvatar
  email="bob@example.com"
  avatarUrl="predefined:beam:variant3"
  size={64}
/>
```

### With Styling
```tsx
// With additional classes
<UserAvatar
  email="alice@example.com"
  avatarUrl={user.avatar_url}
  size={80}
  className="ring-4 ring-brand-200 shadow-lg"
/>
```

### Different Sizes
```tsx
// Small (for lists)
<UserAvatar email="user@example.com" size={24} />

// Medium (default)
<UserAvatar email="user@example.com" size={32} />

// Large (for profiles)
<UserAvatar email="user@example.com" size={80} />

// Extra large (for profile pages)
<UserAvatar email="user@example.com" size={120} />
```

---

## AvatarStack Component

### Basic Usage
```tsx
import AvatarStack from '@/components/AvatarStack'

// Show all avatars (up to 3 by default)
<AvatarStack emails={['user1@example.com', 'user2@example.com']} />
```

### With Custom Max Visible
```tsx
// Show up to 5 avatars before "+N"
<AvatarStack
  emails={[
    'user1@example.com',
    'user2@example.com',
    'user3@example.com',
    'user4@example.com',
    'user5@example.com',
    'user6@example.com'
  ]}
  maxVisible={5}
/>
// Renders: [avatar] [avatar] [avatar] [avatar] [avatar] +1
```

### Different Sizes
```tsx
// Small (for compact views)
<AvatarStack
  emails={taskAssignees}
  size={20}
  maxVisible={3}
/>

// Medium (for task lists)
<AvatarStack
  emails={taskAssignees}
  size={28}
  maxVisible={3}
/>

// Large (for detailed views)
<AvatarStack
  emails={taskAssignees}
  size={40}
  maxVisible={4}
/>
```

### In Task Lists
```tsx
function TaskItem({ task }) {
  return (
    <div className="task-item">
      <h3>{task.title}</h3>
      <p>{task.description}</p>

      {task.assignees?.length > 0 && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-sm text-gray-600">Assigned to:</span>
          <AvatarStack
            emails={task.assignees}
            size={24}
            maxVisible={3}
          />
        </div>
      )}
    </div>
  )
}
```

### With Styling
```tsx
<AvatarStack
  emails={members}
  size={32}
  maxVisible={4}
  className="my-4"
/>
```

---

## AvatarPicker Component

### Basic Modal
```tsx
import { useState } from 'react'
import AvatarPicker from '@/components/AvatarPicker'

function ProfileSettings() {
  const [showPicker, setShowPicker] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url)

  return (
    <>
      <button onClick={() => setShowPicker(true)}>
        Change Avatar
      </button>

      {showPicker && (
        <AvatarPicker
          currentAvatarUrl={avatarUrl}
          userEmail={user.email}
          onAvatarChange={(url) => {
            setAvatarUrl(url)
            // Optionally update backend immediately
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}
```

### With Avatar Preview
```tsx
function ProfileSettings() {
  const [showPicker, setShowPicker] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url)

  return (
    <div className="profile-section">
      <div className="flex items-center gap-4">
        <UserAvatar
          email={user.email}
          avatarUrl={avatarUrl}
          size={80}
          className="ring-2 ring-gray-200"
        />

        <div>
          <h3>{user.full_name || user.email}</h3>
          <button
            onClick={() => setShowPicker(true)}
            className="btn-primary mt-2"
          >
            Change Avatar
          </button>
        </div>
      </div>

      {showPicker && (
        <AvatarPicker
          currentAvatarUrl={avatarUrl}
          userEmail={user.email}
          onAvatarChange={setAvatarUrl}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}
```

### With Save Confirmation
```tsx
function ProfileSettings() {
  const [showPicker, setShowPicker] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url)
  const [tempAvatarUrl, setTempAvatarUrl] = useState(user.avatar_url)

  async function handleSave() {
    // Update backend
    await updateProfile({ avatar_url: tempAvatarUrl })
    setAvatarUrl(tempAvatarUrl)
    alert('Profile updated!')
  }

  return (
    <>
      <UserAvatar email={user.email} avatarUrl={avatarUrl} size={80} />
      <button onClick={() => setShowPicker(true)}>Change</button>

      {showPicker && (
        <AvatarPicker
          currentAvatarUrl={tempAvatarUrl}
          userEmail={user.email}
          onAvatarChange={(url) => {
            setTempAvatarUrl(url)
            // Don't save yet, just preview
          }}
          onClose={() => {
            setShowPicker(false)
            // Optionally revert changes
          }}
        />
      )}

      {tempAvatarUrl !== avatarUrl && (
        <button onClick={handleSave}>Save Changes</button>
      )}
    </>
  )
}
```

---

## Real-World Examples

### User Profile Card
```tsx
function UserProfileCard({ user }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-4">
        <UserAvatar
          email={user.email}
          avatarUrl={user.avatar_url}
          size={64}
          className="ring-2 ring-brand-200"
        />
        <div>
          <h3 className="font-semibold text-lg">{user.full_name}</h3>
          <p className="text-gray-600">{user.email}</p>
          <p className="text-sm text-gray-500">{user.role}</p>
        </div>
      </div>
    </div>
  )
}
```

### Team Member List
```tsx
function TeamMemberList({ members }) {
  return (
    <div className="space-y-3">
      {members.map((member) => (
        <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            <UserAvatar
              email={member.email}
              avatarUrl={member.avatar_url}
              size={40}
            />
            <div>
              <div className="font-medium">{member.full_name}</div>
              <div className="text-sm text-gray-600">{member.email}</div>
            </div>
          </div>
          <span className="text-sm text-gray-500">{member.role}</span>
        </div>
      ))}
    </div>
  )
}
```

### Task Card with Assignees
```tsx
function TaskCard({ task }) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold">{task.title}</h3>
          <p className="text-sm text-gray-600 mt-1">{task.description}</p>
        </div>
        <span className={`status-badge ${task.status}`}>
          {task.status}
        </span>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t">
        <div className="flex items-center gap-2">
          {task.assignees?.length > 0 ? (
            <AvatarStack
              emails={task.assignees}
              size={28}
              maxVisible={3}
            />
          ) : (
            <span className="text-sm text-gray-400">No assignees</span>
          )}
        </div>

        {task.due_at && (
          <span className="text-sm text-gray-600">
            Due: {formatDate(task.due_at)}
          </span>
        )}
      </div>
    </div>
  )
}
```

### Comment with Avatar
```tsx
function Comment({ comment }) {
  return (
    <div className="flex gap-3">
      <UserAvatar
        email={comment.user.email}
        avatarUrl={comment.user.avatar_url}
        size={36}
        className="shrink-0"
      />
      <div className="flex-1">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-sm">{comment.user.full_name}</span>
            <span className="text-xs text-gray-500">{formatTime(comment.created_at)}</span>
          </div>
          <p className="text-sm text-gray-700">{comment.text}</p>
        </div>
      </div>
    </div>
  )
}
```

### Collaborative Board
```tsx
function CollaborativeBoard({ project }) {
  return (
    <div className="border-b py-3 px-4 bg-white">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{project.name}</h2>
          <p className="text-sm text-gray-600">{project.description}</p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            {project.members.length} members
          </span>
          <AvatarStack
            emails={project.members.map(m => m.email)}
            size={32}
            maxVisible={5}
          />
        </div>
      </div>
    </div>
  )
}
```

### Notification Item
```tsx
function NotificationItem({ notification }) {
  return (
    <div className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg">
      <UserAvatar
        email={notification.actor.email}
        avatarUrl={notification.actor.avatar_url}
        size={32}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">{notification.actor.full_name}</span>
          {' '}{notification.action}{' '}
          <span className="font-medium">{notification.target}</span>
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {formatRelativeTime(notification.created_at)}
        </p>
      </div>
    </div>
  )
}
```

---

## Props Reference

### UserAvatar
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `email` | `string` | Yes | - | User's email (seed for default avatar) |
| `avatarUrl` | `string \| null` | No | `null` | Avatar URL or predefined ID |
| `size` | `number` | No | `32` | Avatar size in pixels |
| `className` | `string` | No | `''` | Additional CSS classes |

### AvatarStack
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `emails` | `string[]` | Yes | - | Array of user emails |
| `size` | `number` | No | `32` | Avatar size in pixels |
| `maxVisible` | `number` | No | `3` | Max avatars before "+N" |
| `className` | `string` | No | `''` | Additional CSS classes |

### AvatarPicker
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `currentAvatarUrl` | `string \| null` | No | `null` | Current avatar URL |
| `userEmail` | `string` | Yes | - | User's email |
| `onAvatarChange` | `(url: string) => void` | Yes | - | Callback when avatar changes |
| `onClose` | `() => void` | Yes | - | Callback to close modal |

---

## Tips & Best Practices

1. **Always provide email**: Even if avatar_url is available, email is needed as fallback
2. **Consistent sizing**: Use standard sizes (24, 28, 32, 40, 64, 80) for consistency
3. **Loading states**: AvatarStack fetches profiles, consider showing loading indicator
4. **Error handling**: Components gracefully fallback to generated avatars
5. **Performance**: AvatarStack batches profile queries efficiently
6. **Accessibility**: All avatars include alt text based on email
7. **Responsive**: Test different sizes on mobile devices

## Common Patterns

### Show avatar with fallback text
```tsx
{user.avatar_url ? (
  <UserAvatar email={user.email} avatarUrl={user.avatar_url} size={32} />
) : (
  <div className="avatar-fallback">
    {user.full_name?.[0] || user.email[0]}
  </div>
)}
```

### Conditional avatar display
```tsx
{task.assignees?.length > 0 && (
  <AvatarStack emails={task.assignees} size={24} />
)}
```

### Avatar with tooltip
```tsx
<div title={user.full_name || user.email}>
  <UserAvatar email={user.email} avatarUrl={user.avatar_url} size={32} />
</div>
```
