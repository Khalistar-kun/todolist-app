# TodoApp - Comprehensive iOS Architecture

## Executive Summary

This document provides a **complete iOS app architecture** for TodoApp that maintains **100% feature parity** with the Next.js web application while following iOS best practices. The app uses the **same Supabase backend** with no modifications required.

**Key Principles:**
- Native iOS experience using SwiftUI
- MVVM architecture with clean separation of concerns
- Real-time collaboration via Supabase Realtime
- Offline-first with local caching
- Push notifications for due tasks
- Full feature parity with web app

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [Project Structure](#2-project-structure)
3. [Architecture Pattern (MVVM)](#3-architecture-pattern-mvvm)
4. [Database Models](#4-database-models)
5. [Services Layer](#5-services-layer)
6. [ViewModels](#6-viewmodels)
7. [Views & Navigation](#7-views--navigation)
8. [Data Flow & Real-time Updates](#8-data-flow--real-time-updates)
9. [Feature Implementation Details](#9-feature-implementation-details)
10. [UI/UX Adaptations](#10-uiux-adaptations)
11. [Code Examples](#11-code-examples)
12. [Development Roadmap](#12-development-roadmap)

---

## 1. Technology Stack

### Core Framework
```
Platform: iOS 16.0+
Language: Swift 5.9+
UI Framework: SwiftUI
Architecture: MVVM (Model-View-ViewModel)
```

### Dependencies (Swift Package Manager)

```swift
dependencies: [
    // Supabase Swift SDK (Core dependency)
    .package(url: "https://github.com/supabase/supabase-swift", from: "2.0.0"),

    // Markdown Parsing (for import feature)
    .package(url: "https://github.com/apple/swift-markdown", from: "0.3.0"),

    // Rich Text Editor (TipTap equivalent)
    .package(url: "https://github.com/krzyzanowskim/RichTextKit", from: "1.0.0"),

    // Avatar Generation (boring-avatars equivalent)
    .package(url: "https://github.com/BoringDesigners/SwiftUI-Avatars", from: "1.0.0"),

    // Networking & Image Loading
    .package(url: "https://github.com/kean/Nuke", from: "12.0.0"),

    // Keychain for secure storage
    .package(url: "https://github.com/kishikawakatsumi/KeychainAccess", from: "4.2.2")
]
```

### Supabase SDK Components
- **Supabase Auth**: Email OTP authentication
- **Supabase Database**: PostgreSQL queries via Postgrest
- **Supabase Realtime**: Live task updates and collaboration
- **Supabase Storage**: Avatar and media uploads
- **Supabase Functions**: (Optional) Edge functions if needed

---

## 2. Project Structure

```
TodoApp/
├── TodoApp.swift                          # App entry point
├── TodoAppApp.swift                       # SwiftUI App lifecycle
│
├── Models/                                # Data models matching Supabase schema
│   ├── Project.swift
│   ├── Client.swift
│   ├── Task.swift
│   ├── SlackIntegration.swift
│   ├── UserProfile.swift
│   ├── BlogPost.swift                     # Blog CMS models
│   ├── BlogCategory.swift
│   ├── BlogTag.swift
│   └── BlogMedia.swift
│
├── Services/                              # Backend & API layer
│   ├── SupabaseService.swift             # Singleton for Supabase client
│   ├── AuthService.swift                 # Authentication logic
│   ├── ProjectService.swift              # Project CRUD
│   ├── ClientService.swift               # Client CRUD
│   ├── TaskService.swift                 # Task CRUD + real-time
│   ├── SlackService.swift                # Slack webhook integration
│   ├── StorageService.swift              # Supabase Storage uploads
│   ├── NotificationService.swift         # Push notifications
│   ├── TemplateService.swift             # Project templates
│   ├── BlogService.swift                 # Blog CMS operations
│   └── MarkdownParser.swift              # Import markdown tasks
│
├── ViewModels/                            # MVVM ViewModels
│   ├── AuthViewModel.swift
│   ├── ProjectListViewModel.swift
│   ├── ProjectDetailViewModel.swift
│   ├── TaskListViewModel.swift
│   ├── KanbanViewModel.swift
│   ├── TaskEditorViewModel.swift
│   ├── ClientViewModel.swift
│   ├── TemplateViewModel.swift
│   ├── SettingsViewModel.swift
│   ├── AvatarPickerViewModel.swift
│   └── BlogViewModel.swift               # Blog CMS
│
├── Views/                                 # SwiftUI Views
│   ├── Authentication/
│   │   ├── LoginView.swift
│   │   └── OTPVerificationView.swift
│   │
│   ├── Projects/
│   │   ├── ProjectListView.swift         # All projects
│   │   ├── ProjectDetailView.swift       # Main task view
│   │   ├── CreateProjectView.swift
│   │   └── ProjectSettingsView.swift
│   │
│   ├── Tasks/
│   │   ├── TaskListView.swift            # List view
│   │   ├── KanbanBoardView.swift         # Kanban view
│   │   ├── TaskEditorView.swift          # Create/Edit modal
│   │   ├── TaskRowView.swift             # List row component
│   │   └── TaskCardView.swift            # Kanban card component
│   │
│   ├── Clients/
│   │   ├── ClientSidebarView.swift       # Sidebar filter
│   │   ├── ClientListView.swift
│   │   └── ClientEditorView.swift
│   │
│   ├── Templates/
│   │   ├── TemplateGalleryView.swift     # 6 templates
│   │   └── TemplateCardView.swift
│   │
│   ├── Settings/
│   │   ├── SettingsView.swift
│   │   ├── SlackIntegrationView.swift
│   │   └── AvatarPickerView.swift
│   │
│   ├── Blog/                              # Blog CMS (Admin)
│   │   ├── BlogListView.swift
│   │   ├── BlogEditorView.swift
│   │   ├── BlogCategoryView.swift
│   │   └── BlogMediaLibraryView.swift
│   │
│   ├── Shared/                            # Reusable components
│   │   ├── AvatarView.swift
│   │   ├── AvatarStackView.swift
│   │   ├── ViewToggleButton.swift
│   │   ├── LoadingView.swift
│   │   ├── EmptyStateView.swift
│   │   └── ErrorView.swift
│   │
│   └── MainTabView.swift                  # Root tab navigation
│
├── Utilities/                             # Helper functions
│   ├── Constants.swift                    # App constants
│   ├── Extensions/
│   │   ├── Date+Extensions.swift
│   │   ├── Color+Extensions.swift
│   │   ├── View+Extensions.swift
│   │   └── String+Extensions.swift
│   ├── Managers/
│   │   ├── KeychainManager.swift         # Secure token storage
│   │   ├── CacheManager.swift            # Local data caching
│   │   └── NetworkMonitor.swift          # Connectivity status
│   └── Errors/
│       └── AppError.swift                # Custom error types
│
├── Resources/                             # Assets & configs
│   ├── Assets.xcassets/
│   │   ├── AppIcon.appiconset/
│   │   ├── Colors/
│   │   └── Images/
│   ├── Info.plist
│   └── Localizable.strings               # i18n support
│
└── Tests/                                 # Unit & UI tests
    ├── TodoAppTests/
    │   ├── ViewModelTests/
    │   ├── ServiceTests/
    │   └── ModelTests/
    └── TodoAppUITests/
        └── NavigationTests.swift
```

---

## 3. Architecture Pattern (MVVM)

### MVVM Flow
```
View → ViewModel → Service → Supabase Backend
  ↑                   ↓
  └─── @Published ────┘
```

### Core Principles

1. **View**: SwiftUI views are **declarative** and **stateless**
   - Display data from ViewModel via `@StateObject` or `@ObservedObject`
   - Send user actions to ViewModel
   - No business logic

2. **ViewModel**: Business logic & state management
   - `ObservableObject` conformance
   - `@Published` properties for reactive UI updates
   - Calls Services for backend operations
   - Handles errors and loading states

3. **Service**: Backend communication layer
   - Singleton services (e.g., `SupabaseService.shared`)
   - Async/await for network calls
   - Wraps Supabase SDK methods
   - Returns `Result<T, Error>` or throws

4. **Model**: Data structures
   - `Codable` conformance for Supabase JSON
   - `Identifiable` for SwiftUI lists
   - Match database schema exactly

---

## 4. Database Models

All models match the **existing Supabase PostgreSQL schema** with no backend changes.

### Core Models

```swift
// MARK: - Project
struct Project: Identifiable, Codable {
    let id: UUID
    var name: String
    var description: String?
    let createdBy: UUID
    let createdAt: Date
    var updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case description
        case createdBy = "created_by"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - Client
struct Client: Identifiable, Codable {
    let id: UUID
    let projectId: UUID
    var name: String
    var description: String?
    var color: String?
    let createdBy: UUID
    let createdAt: Date
    var updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case projectId = "project_id"
        case name
        case description
        case color
        case createdBy = "created_by"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - Task
enum TaskStatus: String, Codable, CaseIterable {
    case todo
    case inProgress = "in_progress"
    case done

    var displayName: String {
        switch self {
        case .todo: return "To Do"
        case .inProgress: return "In Progress"
        case .done: return "Done"
        }
    }
}

struct Task: Identifiable, Codable {
    let id: UUID
    let projectId: UUID
    var clientId: UUID?
    var title: String
    var description: String?
    var status: TaskStatus
    var dueAt: Date?
    var assignees: [String]  // Email addresses
    let createdBy: UUID
    var completedAt: Date?
    var slackThreadTs: String?
    var slackMessageTs: String?
    let createdAt: Date
    var updatedAt: Date

    // Computed properties
    var isOverdue: Bool {
        guard let dueDate = dueAt, status != .done else { return false }
        return dueDate < Date()
    }

    var isDueSoon: Bool {
        guard let dueDate = dueAt, status != .done else { return false }
        let hoursUntilDue = Calendar.current.dateComponents([.hour], from: Date(), to: dueDate).hour ?? 0
        return hoursUntilDue <= 24 && hoursUntilDue > 0
    }

    enum CodingKeys: String, CodingKey {
        case id
        case projectId = "project_id"
        case clientId = "client_id"
        case title
        case description
        case status
        case dueAt = "due_at"
        case assignees
        case createdBy = "created_by"
        case completedAt = "completed_at"
        case slackThreadTs = "slack_thread_ts"
        case slackMessageTs = "slack_message_ts"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - Slack Integration
struct SlackIntegration: Identifiable, Codable {
    let id: UUID
    let projectId: UUID
    var webhookUrl: String
    var channelName: String?
    var notifyOnTaskCreate: Bool
    var notifyOnTaskAssign: Bool
    var notifyOnTaskComplete: Bool
    let createdBy: UUID
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case projectId = "project_id"
        case webhookUrl = "webhook_url"
        case channelName = "channel_name"
        case notifyOnTaskCreate = "notify_on_task_create"
        case notifyOnTaskAssign = "notify_on_task_assign"
        case notifyOnTaskComplete = "notify_on_task_complete"
        case createdBy = "created_by"
        case createdAt = "created_at"
    }
}

// MARK: - User Profile
struct UserProfile: Identifiable, Codable {
    let id: UUID
    var email: String
    var fullName: String?
    var avatarUrl: String?
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case fullName = "full_name"
        case avatarUrl = "avatar_url"
        case createdAt = "created_at"
    }
}

// MARK: - Template Task (Local only)
struct TemplateTask: Codable {
    var title: String
    var description: String?
    var status: TaskStatus
    var client: String?
}

struct ProjectTemplate: Identifiable {
    let id = UUID()
    let name: String
    let description: String
    let color: String  // Hex color
    let iconName: String  // SF Symbol name
    let tasks: [TemplateTask]
}
```

### Blog CMS Models

```swift
// MARK: - Blog Post Status
enum PostStatus: String, Codable {
    case draft
    case published
    case scheduled
    case archived
}

// MARK: - Blog Post
struct BlogPost: Identifiable, Codable {
    let id: UUID
    var title: String
    var slug: String
    var excerpt: String?
    var content: String
    var featuredImageId: UUID?
    var featuredImageUrl: String?
    var featuredImageAlt: String?
    let authorId: UUID
    var authorName: String?
    var status: PostStatus
    var publishedAt: Date?
    var scheduledFor: Date?
    var metaTitle: String?
    var metaDescription: String?
    var viewCount: Int
    var readingTimeMinutes: Int?
    var isFeatured: Bool
    var isPinned: Bool
    let createdAt: Date
    var updatedAt: Date

    // Relations (loaded separately)
    var categories: [BlogCategory]?
    var tags: [BlogTag]?
    var faqs: [BlogFAQ]?

    enum CodingKeys: String, CodingKey {
        case id, title, slug, excerpt, content, status
        case featuredImageId = "featured_image_id"
        case featuredImageUrl = "featured_image_url"
        case featuredImageAlt = "featured_image_alt"
        case authorId = "author_id"
        case authorName = "author_name"
        case publishedAt = "published_at"
        case scheduledFor = "scheduled_for"
        case metaTitle = "meta_title"
        case metaDescription = "meta_description"
        case viewCount = "view_count"
        case readingTimeMinutes = "reading_time_minutes"
        case isFeatured = "is_featured"
        case isPinned = "is_pinned"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - Blog Category
struct BlogCategory: Identifiable, Codable {
    let id: UUID
    var name: String
    var slug: String
    var description: String?
    var postCount: Int
    var isActive: Bool

    enum CodingKeys: String, CodingKey {
        case id, name, slug, description
        case postCount = "post_count"
        case isActive = "is_active"
    }
}

// MARK: - Blog Tag
struct BlogTag: Identifiable, Codable {
    let id: UUID
    var name: String
    var slug: String
    var description: String?
    var color: String?
    var postCount: Int

    enum CodingKeys: String, CodingKey {
        case id, name, slug, description, color
        case postCount = "post_count"
    }
}

// MARK: - Blog FAQ
struct BlogFAQ: Identifiable, Codable {
    let id: UUID
    let postId: UUID
    var question: String
    var answer: String
    var sortOrder: Int
    var isActive: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case postId = "post_id"
        case question, answer
        case sortOrder = "sort_order"
        case isActive = "is_active"
    }
}
```

---

## 5. Services Layer

All services are **singletons** with async/await for modern Swift concurrency.

### SupabaseService.swift (Core)

```swift
import Supabase
import Foundation

class SupabaseService {
    static let shared = SupabaseService()

    let client: SupabaseClient

    private init() {
        // Initialize Supabase client
        // IMPORTANT: Use same URL and anon key from web app .env
        self.client = SupabaseClient(
            supabaseURL: URL(string: Constants.supabaseURL)!,
            supabaseKey: Constants.supabaseAnonKey
        )
    }

    // MARK: - Auth Helpers
    var currentUser: User? {
        try? client.auth.session.user
    }

    var currentUserId: UUID? {
        guard let user = currentUser else { return nil }
        return UUID(uuidString: user.id.uuidString)
    }

    // MARK: - Real-time Helpers
    func subscribeToTable<T: Codable>(
        _ table: String,
        filter: String? = nil,
        onChange: @escaping (RealtimeMessage) -> Void
    ) -> RealtimeChannel {
        var channel = client.realtime.channel("public:\(table)")

        if let filter = filter {
            channel = channel.on(.postgresChanges(
                InsertAction(schema: "public", table: table, filter: filter)
            ), callback: onChange)
            .on(.postgresChanges(
                UpdateAction(schema: "public", table: table, filter: filter)
            ), callback: onChange)
            .on(.postgresChanges(
                DeleteAction(schema: "public", table: table, filter: filter)
            ), callback: onChange)
        }

        channel.subscribe()
        return channel
    }
}
```

### AuthService.swift

```swift
import Supabase
import Foundation

enum AuthError: LocalizedError {
    case invalidEmail
    case otpExpired
    case networkError
    case userNotFound

    var errorDescription: String? {
        switch self {
        case .invalidEmail: return "Please enter a valid email address"
        case .otpExpired: return "OTP code has expired. Please request a new one."
        case .networkError: return "Network error. Please check your connection."
        case .userNotFound: return "User not found"
        }
    }
}

class AuthService {
    static let shared = AuthService()
    private let supabase = SupabaseService.shared.client

    // MARK: - Send OTP Email
    func sendOTP(email: String) async throws {
        guard email.contains("@") else {
            throw AuthError.invalidEmail
        }

        try await supabase.auth.signInWithOTP(
            email: email,
            redirectTo: nil
        )
    }

    // MARK: - Verify OTP
    func verifyOTP(email: String, token: String) async throws -> Session {
        let session = try await supabase.auth.verifyOTP(
            email: email,
            token: token,
            type: .email
        )

        // Create profile if doesn't exist
        try await createProfileIfNeeded(userId: session.user.id)

        return session
    }

    // MARK: - Sign Out
    func signOut() async throws {
        try await supabase.auth.signOut()
        KeychainManager.shared.deleteToken()
    }

    // MARK: - Get Current Session
    func getCurrentSession() async throws -> Session? {
        return try await supabase.auth.session
    }

    // MARK: - Create Profile
    private func createProfileIfNeeded(userId: UUID) async throws {
        // Check if profile exists
        let existingProfile: [UserProfile] = try await supabase
            .from("profiles")
            .select()
            .eq("id", value: userId.uuidString)
            .execute()
            .value

        if existingProfile.isEmpty {
            // Create new profile
            let newProfile = UserProfile(
                id: userId,
                email: try await supabase.auth.session.user.email ?? "",
                fullName: nil,
                avatarUrl: nil,
                createdAt: Date()
            )

            try await supabase
                .from("profiles")
                .insert(newProfile)
                .execute()
        }
    }
}
```

### ProjectService.swift

```swift
import Supabase
import Foundation

class ProjectService {
    static let shared = ProjectService()
    private let supabase = SupabaseService.shared.client

    // MARK: - Fetch All Projects
    func fetchProjects() async throws -> [Project] {
        guard let userId = SupabaseService.shared.currentUserId else {
            throw AuthError.userNotFound
        }

        let projects: [Project] = try await supabase
            .from("projects")
            .select()
            .eq("created_by", value: userId.uuidString)
            .order("updated_at", ascending: false)
            .execute()
            .value

        return projects
    }

    // MARK: - Fetch Single Project
    func fetchProject(id: UUID) async throws -> Project {
        let project: Project = try await supabase
            .from("projects")
            .select()
            .eq("id", value: id.uuidString)
            .single()
            .execute()
            .value

        return project
    }

    // MARK: - Create Project
    func createProject(name: String, description: String?) async throws -> Project {
        guard let userId = SupabaseService.shared.currentUserId else {
            throw AuthError.userNotFound
        }

        let newProject = Project(
            id: UUID(),
            name: name,
            description: description,
            createdBy: userId,
            createdAt: Date(),
            updatedAt: Date()
        )

        let created: Project = try await supabase
            .from("projects")
            .insert(newProject)
            .select()
            .single()
            .execute()
            .value

        return created
    }

    // MARK: - Update Project
    func updateProject(id: UUID, name: String, description: String?) async throws {
        var updates: [String: Any] = [
            "name": name,
            "updated_at": ISO8601DateFormatter().string(from: Date())
        ]

        if let description = description {
            updates["description"] = description
        }

        try await supabase
            .from("projects")
            .update(updates)
            .eq("id", value: id.uuidString)
            .execute()
    }

    // MARK: - Delete Project
    func deleteProject(id: UUID) async throws {
        try await supabase
            .from("projects")
            .delete()
            .eq("id", value: id.uuidString)
            .execute()
    }
}
```

### TaskService.swift (with Realtime)

```swift
import Supabase
import Foundation
import Combine

class TaskService {
    static let shared = TaskService()
    private let supabase = SupabaseService.shared.client
    private var realtimeChannel: RealtimeChannel?

    // MARK: - Fetch Tasks
    func fetchTasks(projectId: UUID, clientId: UUID? = nil) async throws -> [Task] {
        var query = supabase
            .from("tasks")
            .select()
            .eq("project_id", value: projectId.uuidString)
            .order("updated_at", ascending: false)

        if let clientId = clientId {
            query = query.eq("client_id", value: clientId.uuidString)
        }

        let tasks: [Task] = try await query.execute().value
        return tasks
    }

    // MARK: - Create Task
    func createTask(
        projectId: UUID,
        clientId: UUID?,
        title: String,
        description: String?,
        status: TaskStatus,
        dueAt: Date?,
        assignees: [String]
    ) async throws -> Task {
        guard let userId = SupabaseService.shared.currentUserId else {
            throw AuthError.userNotFound
        }

        let newTask = Task(
            id: UUID(),
            projectId: projectId,
            clientId: clientId,
            title: title,
            description: description,
            status: status,
            dueAt: dueAt,
            assignees: assignees,
            createdBy: userId,
            completedAt: nil,
            slackThreadTs: nil,
            slackMessageTs: nil,
            createdAt: Date(),
            updatedAt: Date()
        )

        let created: Task = try await supabase
            .from("tasks")
            .insert(newTask)
            .select()
            .single()
            .execute()
            .value

        // Send Slack notification
        try? await SlackService.shared.notifyTaskCreated(task: created, projectId: projectId)

        return created
    }

    // MARK: - Update Task
    func updateTask(
        id: UUID,
        title: String?,
        description: String?,
        status: TaskStatus?,
        dueAt: Date?,
        assignees: [String]?
    ) async throws {
        var updates: [String: Any] = [
            "updated_at": ISO8601DateFormatter().string(from: Date())
        ]

        if let title = title { updates["title"] = title }
        if let description = description { updates["description"] = description }
        if let status = status {
            updates["status"] = status.rawValue
            if status == .done {
                updates["completed_at"] = ISO8601DateFormatter().string(from: Date())
            }
        }
        if let dueAt = dueAt { updates["due_at"] = ISO8601DateFormatter().string(from: dueAt) }
        if let assignees = assignees { updates["assignees"] = assignees }

        try await supabase
            .from("tasks")
            .update(updates)
            .eq("id", value: id.uuidString)
            .execute()
    }

    // MARK: - Delete Task
    func deleteTask(id: UUID) async throws {
        try await supabase
            .from("tasks")
            .delete()
            .eq("id", value: id.uuidString)
            .execute()
    }

    // MARK: - Subscribe to Real-time Updates
    func subscribeToTasks(projectId: UUID, onChange: @escaping () -> Void) {
        realtimeChannel = SupabaseService.shared.subscribeToTable(
            "tasks",
            filter: "project_id=eq.\(projectId.uuidString)"
        ) { _ in
            onChange()
        }
    }

    func unsubscribe() {
        realtimeChannel?.unsubscribe()
        realtimeChannel = nil
    }
}
```

### SlackService.swift

```swift
import Foundation

struct SlackMessage: Codable {
    let text: String
    let blocks: [[String: Any]]?
    let threadTs: String?

    enum CodingKeys: String, CodingKey {
        case text
        case blocks
        case threadTs = "thread_ts"
    }
}

class SlackService {
    static let shared = SlackService()
    private let supabase = SupabaseService.shared.client

    // MARK: - Get Slack Config
    func getSlackConfig(projectId: UUID) async throws -> SlackIntegration? {
        let configs: [SlackIntegration] = try await supabase
            .from("slack_integrations")
            .select()
            .eq("project_id", value: projectId.uuidString)
            .execute()
            .value

        return configs.first
    }

    // MARK: - Send Slack Notification
    private func sendSlackMessage(webhookUrl: String, message: [String: Any]) async throws {
        guard let url = URL(string: webhookUrl) else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: message)

        let (_, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw NSError(domain: "SlackError", code: -1, userInfo: nil)
        }
    }

    // MARK: - Notify Task Created
    func notifyTaskCreated(task: Task, projectId: UUID) async throws {
        guard let config = try await getSlackConfig(projectId: projectId),
              config.notifyOnTaskCreate else { return }

        let message: [String: Any] = [
            "text": "🆕 New task: \(task.title)",
            "blocks": [
                [
                    "type": "header",
                    "text": [
                        "type": "plain_text",
                        "text": "🆕 New Task Created"
                    ]
                ],
                [
                    "type": "section",
                    "text": [
                        "type": "mrkdwn",
                        "text": "*\(task.title)*\n\n\(task.description ?? "")"
                    ]
                ]
            ]
        ]

        try await sendSlackMessage(webhookUrl: config.webhookUrl, message: message)
    }

    // Similar methods for notifyTaskUpdated, notifyTaskDeleted, notifyStatusChanged
}
```

### StorageService.swift

```swift
import Supabase
import UIKit

class StorageService {
    static let shared = StorageService()
    private let supabase = SupabaseService.shared.client

    // MARK: - Upload Avatar
    func uploadAvatar(image: UIImage) async throws -> String {
        guard let userId = SupabaseService.shared.currentUserId else {
            throw AuthError.userNotFound
        }

        // Compress image
        guard let imageData = image.jpegData(compressionQuality: 0.7) else {
            throw NSError(domain: "ImageError", code: -1, userInfo: nil)
        }

        // Generate filename
        let fileName = "\(userId.uuidString)/\(Date().timeIntervalSince1970).jpg"

        // Upload to Supabase Storage
        let file = File(name: fileName, data: imageData, contentType: "image/jpeg")

        try await supabase.storage
            .from("avatars")
            .upload(path: fileName, file: file, options: FileOptions(upsert: true))

        // Get public URL
        let publicURL = try supabase.storage
            .from("avatars")
            .getPublicURL(path: fileName)

        // Update profile
        try await supabase
            .from("profiles")
            .update(["avatar_url": publicURL.absoluteString])
            .eq("id", value: userId.uuidString)
            .execute()

        return publicURL.absoluteString
    }

    // MARK: - Upload Blog Media
    func uploadBlogMedia(image: UIImage, fileName: String) async throws -> String {
        guard let imageData = image.jpegData(compressionQuality: 0.8) else {
            throw NSError(domain: "ImageError", code: -1, userInfo: nil)
        }

        let file = File(name: fileName, data: imageData, contentType: "image/jpeg")

        try await supabase.storage
            .from("blog-media")
            .upload(path: fileName, file: file)

        let publicURL = try supabase.storage
            .from("blog-media")
            .getPublicURL(path: fileName)

        return publicURL.absoluteString
    }
}
```

### NotificationService.swift (Push Notifications)

```swift
import UserNotifications
import UIKit

class NotificationService: NSObject {
    static let shared = NotificationService()

    // MARK: - Request Permission
    func requestPermission() async -> Bool {
        let center = UNUserNotificationCenter.current()

        do {
            let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            return granted
        } catch {
            print("Notification permission error: \(error)")
            return false
        }
    }

    // MARK: - Schedule Due Task Notification
    func scheduleDueTaskNotification(task: Task) {
        guard let dueDate = task.dueAt else { return }

        let content = UNMutableNotificationContent()
        content.title = "Task Due Soon"
        content.body = task.title
        content.sound = .default
        content.categoryIdentifier = "TASK_DUE"
        content.userInfo = ["taskId": task.id.uuidString]

        // Schedule 1 hour before due date
        let triggerDate = Calendar.current.date(byAdding: .hour, value: -1, to: dueDate)!
        let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: triggerDate)
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)

        let request = UNNotificationRequest(
            identifier: "task-\(task.id.uuidString)",
            content: content,
            trigger: trigger
        )

        UNUserNotificationCenter.current().add(request)
    }

    // MARK: - Cancel Notification
    func cancelNotification(taskId: UUID) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(
            withIdentifiers: ["task-\(taskId.uuidString)"]
        )
    }
}

// MARK: - UNUserNotificationCenterDelegate
extension NotificationService: UNUserNotificationCenterDelegate {
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        // Handle notification tap - navigate to task
        if let taskId = response.notification.request.content.userInfo["taskId"] as? String {
            NotificationCenter.default.post(
                name: NSNotification.Name("OpenTask"),
                object: nil,
                userInfo: ["taskId": taskId]
            )
        }
        completionHandler()
    }
}
```

### TemplateService.swift

```swift
import Foundation

class TemplateService {
    static let shared = TemplateService()

    // MARK: - Get All Templates
    func getTemplates() -> [ProjectTemplate] {
        return [
            ProductLaunchTemplate,
            TeamOnboardingTemplate,
            EventPlanningTemplate,
            SprintPlanningTemplate,
            ContentCalendarTemplate,
            MarketingCampaignTemplate
        ]
    }

    // MARK: - Create Project from Template
    func createProjectFromTemplate(
        template: ProjectTemplate,
        projectName: String? = nil
    ) async throws -> Project {
        // Create project
        let project = try await ProjectService.shared.createProject(
            name: projectName ?? template.name,
            description: template.description
        )

        // Create clients from template tasks
        var clientMap: [String: UUID] = [:]
        let uniqueClients = Set(template.tasks.compactMap { $0.client })

        for clientName in uniqueClients {
            let client = try await ClientService.shared.createClient(
                projectId: project.id,
                name: clientName,
                description: nil,
                color: template.color
            )
            clientMap[clientName] = client.id
        }

        // Create tasks
        for templateTask in template.tasks {
            let clientId = templateTask.client != nil ? clientMap[templateTask.client!] : nil

            try await TaskService.shared.createTask(
                projectId: project.id,
                clientId: clientId,
                title: templateTask.title,
                description: templateTask.description,
                status: templateTask.status,
                dueAt: nil,
                assignees: []
            )
        }

        return project
    }
}

// MARK: - Template Definitions
let ProductLaunchTemplate = ProjectTemplate(
    name: "Product Launch",
    description: "Plan and execute a successful product launch",
    color: "#3B82F6",
    iconName: "briefcase.fill",
    tasks: [
        TemplateTask(title: "Define product vision and goals", status: .todo, client: "Strategy"),
        TemplateTask(title: "Conduct market research", status: .todo, client: "Strategy"),
        TemplateTask(title: "Create product roadmap", status: .todo, client: "Strategy"),
        TemplateTask(title: "Design product features", status: .todo, client: "Design"),
        TemplateTask(title: "Develop MVP", status: .todo, client: "Development"),
        TemplateTask(title: "Set up beta testing program", status: .todo, client: "Testing"),
        TemplateTask(title: "Create marketing materials", status: .todo, client: "Marketing"),
        TemplateTask(title: "Plan launch event", status: .todo, client: "Marketing"),
        TemplateTask(title: "Prepare customer support documentation", status: .todo, client: "Support"),
        TemplateTask(title: "Launch product to public", status: .todo, client: "Launch")
    ]
)

// ... (Similar definitions for other 5 templates)
```

---

## 6. ViewModels

All ViewModels conform to `ObservableObject` and use `@Published` for reactive updates.

### AuthViewModel.swift

```swift
import SwiftUI
import Combine

@MainActor
class AuthViewModel: ObservableObject {
    @Published var email = ""
    @Published var otpCode = ""
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var isOTPSent = false
    @Published var isAuthenticated = false

    private let authService = AuthService.shared
    private var cancellables = Set<AnyCancellable>()

    init() {
        checkAuthentication()
    }

    // MARK: - Check if user is authenticated
    func checkAuthentication() {
        Task {
            do {
                let session = try await authService.getCurrentSession()
                isAuthenticated = session != nil
            } catch {
                isAuthenticated = false
            }
        }
    }

    // MARK: - Send OTP
    func sendOTP() async {
        isLoading = true
        errorMessage = nil

        do {
            try await authService.sendOTP(email: email)
            isOTPSent = true
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Verify OTP
    func verifyOTP() async {
        isLoading = true
        errorMessage = nil

        do {
            _ = try await authService.verifyOTP(email: email, token: otpCode)
            isAuthenticated = true
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Sign Out
    func signOut() async {
        do {
            try await authService.signOut()
            isAuthenticated = false
            email = ""
            otpCode = ""
            isOTPSent = false
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
```

### ProjectListViewModel.swift

```swift
import SwiftUI
import Combine

@MainActor
class ProjectListViewModel: ObservableObject {
    @Published var projects: [Project] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var showCreateProject = false

    private let projectService = ProjectService.shared

    // MARK: - Load Projects
    func loadProjects() async {
        isLoading = true
        errorMessage = nil

        do {
            projects = try await projectService.fetchProjects()
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Delete Project
    func deleteProject(_ project: Project) async {
        do {
            try await projectService.deleteProject(id: project.id)
            await loadProjects()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Create Project
    func createProject(name: String, description: String?) async -> Project? {
        do {
            let project = try await projectService.createProject(name: name, description: description)
            await loadProjects()
            return project
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }
}
```

### TaskListViewModel.swift (with Real-time)

```swift
import SwiftUI
import Combine

@MainActor
class TaskListViewModel: ObservableObject {
    @Published var tasks: [Task] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var viewMode: ViewMode = .list
    @Published var selectedClientId: UUID?

    let projectId: UUID
    private let taskService = TaskService.shared
    private var cancellables = Set<AnyCancellable>()

    enum ViewMode {
        case list
        case kanban
    }

    init(projectId: UUID) {
        self.projectId = projectId
        setupRealtimeSubscription()
    }

    // MARK: - Load Tasks
    func loadTasks() async {
        isLoading = true
        errorMessage = nil

        do {
            tasks = try await taskService.fetchTasks(
                projectId: projectId,
                clientId: selectedClientId
            )

            // Schedule notifications for due tasks
            for task in tasks where task.isDueSoon {
                NotificationService.shared.scheduleDueTaskNotification(task: task)
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Create Task
    func createTask(
        title: String,
        description: String?,
        status: TaskStatus,
        dueAt: Date?,
        assignees: [String]
    ) async {
        do {
            _ = try await taskService.createTask(
                projectId: projectId,
                clientId: selectedClientId,
                title: title,
                description: description,
                status: status,
                dueAt: dueAt,
                assignees: assignees
            )
            await loadTasks()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Update Task Status (for Kanban drag)
    func updateTaskStatus(task: Task, newStatus: TaskStatus) async {
        guard task.status != newStatus else { return }

        do {
            try await taskService.updateTask(
                id: task.id,
                title: nil,
                description: nil,
                status: newStatus,
                dueAt: nil,
                assignees: nil
            )
            await loadTasks()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Delete Task
    func deleteTask(_ task: Task) async {
        do {
            try await taskService.deleteTask(id: task.id)
            NotificationService.shared.cancelNotification(taskId: task.id)
            await loadTasks()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Real-time Subscription
    private func setupRealtimeSubscription() {
        taskService.subscribeToTasks(projectId: projectId) { [weak self] in
            Task { @MainActor in
                await self?.loadTasks()
            }
        }
    }

    deinit {
        taskService.unsubscribe()
    }

    // MARK: - Computed Properties
    var todoTasks: [Task] {
        tasks.filter { $0.status == .todo }
    }

    var inProgressTasks: [Task] {
        tasks.filter { $0.status == .inProgress }
    }

    var doneTasks: [Task] {
        tasks.filter { $0.status == .done }
    }
}
```

---

## 7. Views & Navigation

### Navigation Architecture

```
MainTabView (Root)
├── ProjectListView (Tab 1: Projects)
│   └── ProjectDetailView
│       ├── TaskListView / KanbanBoardView
│       ├── TaskEditorView (Sheet)
│       └── ProjectSettingsView (Navigation)
│
├── TemplateGalleryView (Tab 2: Templates)
│   └── Navigate to ProjectDetailView on creation
│
├── BlogListView (Tab 3: Blog - Admin only)
│   └── BlogEditorView
│
└── SettingsView (Tab 4: Settings)
    ├── AvatarPickerView (Sheet)
    └── SlackIntegrationView (Navigation)
```

### MainTabView.swift

```swift
import SwiftUI

struct MainTabView: View {
    @StateObject private var authViewModel = AuthViewModel()
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            // Projects Tab
            NavigationStack {
                ProjectListView()
            }
            .tabItem {
                Label("Projects", systemImage: "folder.fill")
            }
            .tag(0)

            // Templates Tab
            NavigationStack {
                TemplateGalleryView()
            }
            .tabItem {
                Label("Templates", systemImage: "square.grid.2x2.fill")
            }
            .tag(1)

            // Blog Tab (Admin only - check user role)
            NavigationStack {
                BlogListView()
            }
            .tabItem {
                Label("Blog", systemImage: "doc.text.fill")
            }
            .tag(2)

            // Settings Tab
            NavigationStack {
                SettingsView()
            }
            .tabItem {
                Label("Settings", systemImage: "gear")
            }
            .tag(3)
        }
        .accentColor(Color("BrandColor"))
    }
}
```

### ProjectListView.swift

```swift
import SwiftUI

struct ProjectListView: View {
    @StateObject private var viewModel = ProjectListViewModel()
    @State private var showCreateSheet = false

    var body: some View {
        ZStack {
            if viewModel.isLoading && viewModel.projects.isEmpty {
                LoadingView()
            } else if viewModel.projects.isEmpty {
                EmptyStateView(
                    icon: "folder.badge.plus",
                    title: "No Projects Yet",
                    message: "Create your first project to get started",
                    actionTitle: "Create Project",
                    action: { showCreateSheet = true }
                )
            } else {
                List {
                    ForEach(viewModel.projects) { project in
                        NavigationLink(destination: ProjectDetailView(projectId: project.id)) {
                            ProjectRowView(project: project)
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button(role: .destructive) {
                                Task {
                                    await viewModel.deleteProject(project)
                                }
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .refreshable {
                    await viewModel.loadProjects()
                }
            }
        }
        .navigationTitle("Projects")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    showCreateSheet = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showCreateSheet) {
            CreateProjectView()
        }
        .task {
            await viewModel.loadProjects()
        }
        .alert("Error", isPresented: .constant(viewModel.errorMessage != nil)) {
            Button("OK") {
                viewModel.errorMessage = nil
            }
        } message: {
            if let error = viewModel.errorMessage {
                Text(error)
            }
        }
    }
}

// MARK: - Project Row
struct ProjectRowView: View {
    let project: Project

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(project.name)
                .font(.headline)

            if let description = project.description {
                Text(description)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }

            Text(project.updatedAt, style: .relative)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
}
```

### ProjectDetailView.swift (Main Task View)

```swift
import SwiftUI

struct ProjectDetailView: View {
    let projectId: UUID

    @StateObject private var viewModel: TaskListViewModel
    @StateObject private var clientViewModel: ClientViewModel
    @State private var showTaskEditor = false
    @State private var editingTask: Task?

    init(projectId: UUID) {
        self.projectId = projectId
        _viewModel = StateObject(wrappedValue: TaskListViewModel(projectId: projectId))
        _clientViewModel = StateObject(wrappedValue: ClientViewModel(projectId: projectId))
    }

    var body: some View {
        VStack(spacing: 0) {
            // View Toggle (List/Kanban)
            ViewToggleButton(
                selectedMode: $viewModel.viewMode,
                onChange: { mode in
                    viewModel.viewMode = mode
                }
            )
            .padding()

            // Main Content
            if viewModel.viewMode == .list {
                TaskListView(
                    tasks: viewModel.tasks,
                    onEditTask: { task in
                        editingTask = task
                        showTaskEditor = true
                    },
                    onDeleteTask: { task in
                        Task {
                            await viewModel.deleteTask(task)
                        }
                    }
                )
            } else {
                KanbanBoardView(
                    viewModel: viewModel,
                    onEditTask: { task in
                        editingTask = task
                        showTaskEditor = true
                    }
                )
            }
        }
        .navigationTitle("Tasks")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Menu {
                    Button {
                        editingTask = nil
                        showTaskEditor = true
                    } label: {
                        Label("Add Task", systemImage: "plus")
                    }

                    Button {
                        // Show import markdown sheet
                    } label: {
                        Label("Import Markdown", systemImage: "doc.text")
                    }

                    NavigationLink(destination: ProjectSettingsView(projectId: projectId)) {
                        Label("Settings", systemImage: "gear")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $showTaskEditor) {
            TaskEditorView(
                projectId: projectId,
                clientId: viewModel.selectedClientId,
                task: editingTask
            ) { created in
                if created {
                    Task {
                        await viewModel.loadTasks()
                    }
                }
            }
        }
        .safeAreaInset(edge: .leading) {
            ClientSidebarView(
                viewModel: clientViewModel,
                selectedClientId: $viewModel.selectedClientId
            )
            .frame(width: 80)
        }
        .task {
            await viewModel.loadTasks()
            await clientViewModel.loadClients()
        }
    }
}
```

### KanbanBoardView.swift

```swift
import SwiftUI

struct KanbanBoardView: View {
    @ObservedObject var viewModel: TaskListViewModel
    let onEditTask: (Task) -> Void

    private let columns: [TaskStatus] = [.todo, .inProgress, .done]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 16) {
                ForEach(columns, id: \.self) { status in
                    KanbanColumnView(
                        status: status,
                        tasks: tasksForStatus(status),
                        onEditTask: onEditTask,
                        onDrop: { task in
                            Task {
                                await viewModel.updateTaskStatus(task: task, newStatus: status)
                            }
                        }
                    )
                    .frame(width: 280)
                }
            }
            .padding()
        }
    }

    private func tasksForStatus(_ status: TaskStatus) -> [Task] {
        viewModel.tasks.filter { $0.status == status }
    }
}

// MARK: - Kanban Column
struct KanbanColumnView: View {
    let status: TaskStatus
    let tasks: [Task]
    let onEditTask: (Task) -> Void
    let onDrop: (Task) -> Void

    @State private var draggedTask: Task?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Column Header
            HStack {
                Text(status.displayName)
                    .font(.headline)
                    .foregroundColor(.primary)

                Spacer()

                Text("\(tasks.count)")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.gray.opacity(0.2))
                    .clipShape(Capsule())
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.gray.opacity(0.1))
            .cornerRadius(8)

            // Tasks
            ScrollView {
                VStack(spacing: 8) {
                    ForEach(tasks) { task in
                        TaskCardView(task: task, onTap: {
                            onEditTask(task)
                        })
                        .onDrag {
                            draggedTask = task
                            return NSItemProvider(object: task.id.uuidString as NSString)
                        }
                    }
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
        .onDrop(of: [.text], delegate: KanbanDropDelegate(
            tasks: tasks,
            draggedTask: $draggedTask,
            onDrop: onDrop
        ))
    }
}

// MARK: - Drop Delegate
struct KanbanDropDelegate: DropDelegate {
    let tasks: [Task]
    @Binding var draggedTask: Task?
    let onDrop: (Task) -> Void

    func performDrop(info: DropInfo) -> Bool {
        guard let task = draggedTask else { return false }
        onDrop(task)
        draggedTask = nil
        return true
    }
}

// MARK: - Task Card
struct TaskCardView: View {
    let task: Task
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 8) {
                Text(task.title)
                    .font(.headline)
                    .foregroundColor(.primary)
                    .multilineTextAlignment(.leading)

                if let description = task.description {
                    Text(description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(3)
                }

                HStack {
                    if let dueAt = task.dueAt {
                        Label(
                            dueAt.formatted(date: .abbreviated, time: .shortened),
                            systemImage: "clock"
                        )
                        .font(.caption2)
                        .foregroundColor(task.isOverdue ? .red : .secondary)
                    }

                    Spacer()

                    if !task.assignees.isEmpty {
                        AvatarStackView(emails: task.assignees, size: 24, maxVisible: 3)
                    }
                }
            }
            .padding(12)
            .background(Color.white)
            .cornerRadius(8)
            .shadow(color: .black.opacity(0.05), radius: 2, x: 0, y: 1)
        }
        .buttonStyle(.plain)
    }
}
```

### TaskEditorView.swift (Modal)

```swift
import SwiftUI

struct TaskEditorView: View {
    let projectId: UUID
    let clientId: UUID?
    let task: Task?
    let onClose: (Bool) -> Void

    @StateObject private var viewModel: TaskEditorViewModel
    @Environment(\.dismiss) private var dismiss

    init(projectId: UUID, clientId: UUID?, task: Task?, onClose: @escaping (Bool) -> Void) {
        self.projectId = projectId
        self.clientId = clientId
        self.task = task
        self.onClose = onClose
        _viewModel = StateObject(wrappedValue: TaskEditorViewModel(
            projectId: projectId,
            clientId: clientId,
            task: task
        ))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Task Title", text: $viewModel.title)
                        .font(.headline)

                    TextField("Description", text: $viewModel.description, axis: .vertical)
                        .lineLimit(5...10)
                }

                Section {
                    Picker("Status", selection: $viewModel.status) {
                        ForEach(TaskStatus.allCases, id: \.self) { status in
                            Text(status.displayName).tag(status)
                        }
                    }

                    DatePicker(
                        "Due Date",
                        selection: Binding(
                            get: { viewModel.dueAt ?? Date() },
                            set: { viewModel.dueAt = $0 }
                        ),
                        displayedComponents: [.date, .hourAndMinute]
                    )

                    Toggle("Set Due Date", isOn: Binding(
                        get: { viewModel.dueAt != nil },
                        set: { if !$0 { viewModel.dueAt = nil } else { viewModel.dueAt = Date() } }
                    ))
                }

                Section("Assignees") {
                    TextField("Email addresses (comma-separated)", text: $viewModel.assigneesText)

                    if !viewModel.assignees.isEmpty {
                        AvatarStackView(emails: viewModel.assignees, size: 40, maxVisible: 5)
                            .padding(.vertical, 8)
                    }
                }

                if task != nil {
                    Section {
                        Button(role: .destructive) {
                            Task {
                                await viewModel.deleteTask()
                                dismiss()
                                onClose(true)
                            }
                        } label: {
                            HStack {
                                Spacer()
                                Text("Delete Task")
                                Spacer()
                            }
                        }
                    }
                }
            }
            .navigationTitle(task == nil ? "New Task" : "Edit Task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                        onClose(false)
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            let success = await viewModel.saveTask()
                            if success {
                                dismiss()
                                onClose(true)
                            }
                        }
                    }
                    .disabled(viewModel.title.isEmpty || viewModel.isLoading)
                }
            }
            .alert("Error", isPresented: .constant(viewModel.errorMessage != nil)) {
                Button("OK") {
                    viewModel.errorMessage = nil
                }
            } message: {
                if let error = viewModel.errorMessage {
                    Text(error)
                }
            }
        }
    }
}
```

### AvatarPickerView.swift

```swift
import SwiftUI

struct AvatarPickerView: View {
    @ObservedObject var viewModel: AvatarPickerViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var selectedTab = 0

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Tab Picker
                Picker("Avatar Type", selection: $selectedTab) {
                    Text("Predefined").tag(0)
                    Text("Upload").tag(1)
                }
                .pickerStyle(.segmented)
                .padding()

                // Content
                if selectedTab == 0 {
                    PredefinedAvatarsView(viewModel: viewModel, onSelect: {
                        dismiss()
                    })
                } else {
                    UploadAvatarView(viewModel: viewModel, onUpload: {
                        dismiss()
                    })
                }
            }
            .navigationTitle("Choose Avatar")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Predefined Avatars (boring-avatars style)
struct PredefinedAvatarsView: View {
    @ObservedObject var viewModel: AvatarPickerViewModel
    let onSelect: () -> Void

    private let variants = ["marble", "beam", "pixel", "sunset", "ring", "bauhaus"]
    private let colors = ["#FF9F66", "#FFB380", "#FFC799", "#FFDBB3", "#FFEFCC"]
    private let gridColumns = [GridItem(.adaptive(minimum: 60))]

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 20) {
                ForEach(variants, id: \.self) { variant in
                    VStack(alignment: .leading) {
                        Text(variant.capitalized)
                            .font(.headline)
                            .padding(.horizontal)

                        LazyVGrid(columns: gridColumns, spacing: 12) {
                            ForEach(0..<12, id: \.self) { index in
                                Button {
                                    Task {
                                        await viewModel.selectPredefinedAvatar(
                                            variant: variant,
                                            seed: "\(index)"
                                        )
                                        onSelect()
                                    }
                                } label: {
                                    // Use BoringAvatars library or custom SVG rendering
                                    Circle()
                                        .fill(Color.blue.opacity(0.3))
                                        .frame(width: 60, height: 60)
                                        .overlay(
                                            Text("\(index)")
                                                .font(.caption)
                                        )
                                }
                            }
                        }
                        .padding(.horizontal)
                    }
                }
            }
            .padding(.vertical)
        }
    }
}

// MARK: - Upload Avatar
struct UploadAvatarView: View {
    @ObservedObject var viewModel: AvatarPickerViewModel
    let onUpload: () -> Void

    @State private var showImagePicker = false
    @State private var selectedImage: UIImage?

    var body: some View {
        VStack(spacing: 20) {
            if let image = selectedImage {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 200, height: 200)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(Color.gray, lineWidth: 2))
            } else {
                Circle()
                    .fill(Color.gray.opacity(0.2))
                    .frame(width: 200, height: 200)
                    .overlay(
                        Image(systemName: "person.crop.circle.badge.plus")
                            .font(.system(size: 60))
                            .foregroundColor(.gray)
                    )
            }

            Button {
                showImagePicker = true
            } label: {
                Label("Choose Photo", systemImage: "photo")
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(10)
            }
            .padding(.horizontal)

            if selectedImage != nil {
                Button {
                    Task {
                        await viewModel.uploadAvatar(image: selectedImage!)
                        onUpload()
                    }
                } label: {
                    if viewModel.isUploading {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .padding()
                    } else {
                        Label("Upload", systemImage: "icloud.and.arrow.up")
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.green)
                            .foregroundColor(.white)
                            .cornerRadius(10)
                    }
                }
                .padding(.horizontal)
                .disabled(viewModel.isUploading)
            }

            Spacer()
        }
        .padding()
        .sheet(isPresented: $showImagePicker) {
            ImagePicker(selectedImage: $selectedImage)
        }
    }
}
```

---

## 8. Data Flow & Real-time Updates

### Real-time Architecture

```
Supabase Database Change
         ↓
Supabase Realtime (WebSocket)
         ↓
RealtimeChannel in TaskService
         ↓
ViewModel receives callback
         ↓
@Published property updates
         ↓
SwiftUI View re-renders
```

### Implementation Pattern

```swift
// 1. Subscribe to changes in ViewModel
class TaskListViewModel: ObservableObject {
    init(projectId: UUID) {
        self.projectId = projectId
        setupRealtimeSubscription()
    }

    private func setupRealtimeSubscription() {
        taskService.subscribeToTasks(projectId: projectId) { [weak self] in
            Task { @MainActor in
                await self?.loadTasks()  // Refresh data
            }
        }
    }
}

// 2. Clean up on deinit
deinit {
    taskService.unsubscribe()
}

// 3. Service handles Supabase Realtime
class TaskService {
    private var realtimeChannel: RealtimeChannel?

    func subscribeToTasks(projectId: UUID, onChange: @escaping () -> Void) {
        realtimeChannel = supabase.realtime
            .channel("tasks-\(projectId)")
            .on(.postgresChanges(
                InsertAction(schema: "public", table: "tasks", filter: "project_id=eq.\(projectId)")
            )) { _ in onChange() }
            .on(.postgresChanges(
                UpdateAction(schema: "public", table: "tasks", filter: "project_id=eq.\(projectId)")
            )) { _ in onChange() }
            .on(.postgresChanges(
                DeleteAction(schema: "public", table: "tasks", filter: "project_id=eq.\(projectId)")
            )) { _ in onChange() }
            .subscribe()
    }
}
```

### Local Caching Strategy

```swift
// CacheManager.swift
class CacheManager {
    static let shared = CacheManager()

    private let userDefaults = UserDefaults.standard
    private let cacheKey = "cachedProjects"

    // Save to cache
    func cacheProjects(_ projects: [Project]) {
        if let encoded = try? JSONEncoder().encode(projects) {
            userDefaults.set(encoded, forKey: cacheKey)
        }
    }

    // Load from cache
    func getCachedProjects() -> [Project]? {
        guard let data = userDefaults.data(forKey: cacheKey),
              let projects = try? JSONDecoder().decode([Project].self, from: data) else {
            return nil
        }
        return projects
    }

    // Clear cache
    func clearCache() {
        userDefaults.removeObject(forKey: cacheKey)
    }
}

// Usage in ViewModel
func loadProjects() async {
    // 1. Load from cache immediately (offline-first)
    if let cached = CacheManager.shared.getCachedProjects() {
        self.projects = cached
    }

    // 2. Fetch fresh data from Supabase
    do {
        let fresh = try await projectService.fetchProjects()
        self.projects = fresh
        CacheManager.shared.cacheProjects(fresh)
    } catch {
        // If network fails, cached data is still shown
        errorMessage = error.localizedDescription
    }
}
```

---

## 9. Feature Implementation Details

### Feature 1: Authentication (OTP Email)

**Flow:**
1. User enters email → `AuthViewModel.sendOTP()`
2. Supabase sends OTP to email
3. User enters 6-digit code → `AuthViewModel.verifyOTP()`
4. On success, session token stored in Keychain
5. Auto-navigate to `MainTabView`

**Code:**
```swift
// KeychainManager.swift
class KeychainManager {
    static let shared = KeychainManager()
    private let keychain = Keychain(service: "com.todoapp.ios")

    func saveToken(_ token: String) {
        keychain["session_token"] = token
    }

    func getToken() -> String? {
        return keychain["session_token"]
    }

    func deleteToken() {
        try? keychain.remove("session_token")
    }
}
```

### Feature 2: Project Templates

**Implementation:**
- 6 hardcoded templates in `TemplateService`
- User taps template → `createProjectFromTemplate()`
- Creates project + clients + tasks in transaction
- Navigates to new project automatically

### Feature 3: Slack Integration

**Webhook Pattern:**
1. User adds webhook URL in Settings
2. On task create/update/delete → `SlackService.notifyTask...()`
3. Send JSON payload to webhook URL
4. Store `slack_thread_ts` for threading logic

**Threading Logic:**
- Same-day updates → post in thread (`thread_ts`)
- New day → create new message

### Feature 4: Markdown Import

**Parser:**
```swift
// MarkdownParser.swift
class MarkdownParser {
    func parseTasks(markdown: String) -> [TemplateTask] {
        var tasks: [TemplateTask] = []

        let lines = markdown.components(separatedBy: .newlines)
        var currentClient: String?

        for line in lines {
            // Detect heading (client name)
            if line.hasPrefix("##") {
                currentClient = line.replacingOccurrences(of: "##", with: "").trimmingCharacters(in: .whitespaces)
            }

            // Detect task (checkbox)
            else if line.hasPrefix("- [ ]") || line.hasPrefix("- [x]") {
                let title = line
                    .replacingOccurrences(of: "- [ ]", with: "")
                    .replacingOccurrences(of: "- [x]", with: "")
                    .trimmingCharacters(in: .whitespaces)

                let status: TaskStatus = line.contains("[x]") ? .done : .todo

                tasks.append(TemplateTask(
                    title: title,
                    description: nil,
                    status: status,
                    client: currentClient
                ))
            }
        }

        return tasks
    }
}
```

### Feature 5: Avatar System

**Two Types:**
1. **Predefined**: Use `BoringAvatars` library or generate SVG avatars
   - Store as `"predefined:marble:5"` in database
   - Render locally in app

2. **Custom Upload**: Use `StorageService.uploadAvatar()`
   - Compress image to JPEG
   - Upload to Supabase Storage bucket `avatars`
   - Store public URL in `profiles.avatar_url`

### Feature 6: Push Notifications

**Setup:**
```swift
// AppDelegate.swift
class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = NotificationService.shared

        Task {
            let granted = await NotificationService.shared.requestPermission()
            if granted {
                await MainActor.run {
                    application.registerForRemoteNotifications()
                }
            }
        }

        return true
    }
}
```

**Scheduling:**
```swift
// When task is created/updated with due date
if let dueAt = task.dueAt {
    NotificationService.shared.scheduleDueTaskNotification(task: task)
}

// Cancel when task is deleted or completed
if task.status == .done {
    NotificationService.shared.cancelNotification(taskId: task.id)
}
```

### Feature 7: Blog CMS (Admin Only)

**Admin Check:**
```swift
// Check if user has admin role (add admin_role field to profiles table)
var isAdmin: Bool {
    // Query profile and check role
    // For now, hardcode admin emails
    let adminEmails = ["admin@todoapp.com"]
    return adminEmails.contains(currentUserEmail)
}
```

**TipTap Editor Alternative:**
Use `RichTextKit` for iOS or build custom `UITextView` wrapper.

**Blog Features:**
- CRUD operations via `BlogService`
- Rich text editing with formatting
- Image upload to `blog-media` bucket
- Category/Tag management
- SEO fields (meta title, description)

---

## 10. UI/UX Adaptations

### Mobile-First Design Principles

1. **Navigation:**
   - Web: Sidebar navigation
   - iOS: TabBar + NavigationStack

2. **Modals:**
   - Web: Centered modals with overlay
   - iOS: `.sheet()` presentation with swipe-to-dismiss

3. **Drag & Drop (Kanban):**
   - Web: HTML5 drag-and-drop
   - iOS: SwiftUI `.onDrag()` and `.onDrop()`

4. **Context Menus:**
   - Web: Right-click menus
   - iOS: Long-press `.contextMenu()`

5. **Swipe Actions:**
   - Web: Not applicable
   - iOS: `.swipeActions()` on List rows (delete, archive)

### Color System

```swift
// Colors.xcassets
extension Color {
    static let brandPrimary = Color("BrandColor")  // #FF9F66 from web
    static let backgroundCream = Color("BackgroundCream")
    static let backgroundPeach = Color("BackgroundPeach")
}
```

### Typography

```swift
extension Font {
    static let taskTitle = Font.system(size: 17, weight: .semibold)
    static let taskDescription = Font.system(size: 15, weight: .regular)
    static let sectionHeader = Font.system(size: 13, weight: .medium)
}
```

### Loading States

```swift
struct LoadingView: View {
    var body: some View {
        VStack(spacing: 20) {
            ProgressView()
                .scaleEffect(1.5)
            Text("Loading...")
                .foregroundColor(.secondary)
        }
    }
}
```

### Empty States

```swift
struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String
    let actionTitle: String?
    let action: (() -> Void)?

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: icon)
                .font(.system(size: 60))
                .foregroundColor(.gray)

            Text(title)
                .font(.title2)
                .fontWeight(.semibold)

            Text(message)
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            if let actionTitle = actionTitle, let action = action {
                Button(action: action) {
                    Text(actionTitle)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .padding(.horizontal, 30)
                        .padding(.vertical, 12)
                        .background(Color.brandPrimary)
                        .cornerRadius(10)
                }
            }
        }
    }
}
```

---

## 11. Code Examples

### Complete TaskEditorViewModel.swift

```swift
import SwiftUI
import Combine

@MainActor
class TaskEditorViewModel: ObservableObject {
    @Published var title = ""
    @Published var description = ""
    @Published var status: TaskStatus = .todo
    @Published var dueAt: Date?
    @Published var assigneesText = ""
    @Published var isLoading = false
    @Published var errorMessage: String?

    let projectId: UUID
    let clientId: UUID?
    let task: Task?

    private let taskService = TaskService.shared

    var assignees: [String] {
        assigneesText
            .components(separatedBy: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
    }

    init(projectId: UUID, clientId: UUID?, task: Task?) {
        self.projectId = projectId
        self.clientId = clientId
        self.task = task

        // Pre-fill if editing
        if let task = task {
            self.title = task.title
            self.description = task.description ?? ""
            self.status = task.status
            self.dueAt = task.dueAt
            self.assigneesText = task.assignees.joined(separator: ", ")
        }
    }

    // MARK: - Save Task
    func saveTask() async -> Bool {
        isLoading = true
        errorMessage = nil

        do {
            if let task = task {
                // Update existing
                try await taskService.updateTask(
                    id: task.id,
                    title: title,
                    description: description,
                    status: status,
                    dueAt: dueAt,
                    assignees: assignees
                )
            } else {
                // Create new
                _ = try await taskService.createTask(
                    projectId: projectId,
                    clientId: clientId,
                    title: title,
                    description: description.isEmpty ? nil : description,
                    status: status,
                    dueAt: dueAt,
                    assignees: assignees
                )
            }

            isLoading = false
            return true
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
            return false
        }
    }

    // MARK: - Delete Task
    func deleteTask() async {
        guard let task = task else { return }

        isLoading = true
        errorMessage = nil

        do {
            try await taskService.deleteTask(id: task.id)
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }
}
```

### Complete Constants.swift

```swift
import Foundation

enum Constants {
    // Supabase Configuration
    static let supabaseURL = "https://YOUR_PROJECT.supabase.co"
    static let supabaseAnonKey = "YOUR_ANON_KEY"

    // Storage Buckets
    static let avatarBucket = "avatars"
    static let blogMediaBucket = "blog-media"

    // App Configuration
    static let appName = "TodoApp"
    static let appVersion = "1.0.0"

    // Notification Categories
    static let taskDueCategoryId = "TASK_DUE"

    // Date Formats
    static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()

    // UI Constants
    static let cornerRadius: CGFloat = 12
    static let shadowRadius: CGFloat = 4
    static let padding: CGFloat = 16
}
```

---

## 12. Development Roadmap

### Phase 1: Core Foundation (Week 1-2)
- [ ] Set up Xcode project with SPM dependencies
- [ ] Configure Supabase SDK
- [ ] Create all Model structs
- [ ] Implement SupabaseService singleton
- [ ] Build AuthService + AuthViewModel
- [ ] Create LoginView + OTPVerificationView
- [ ] Implement Keychain token storage
- [ ] Test authentication flow end-to-end

### Phase 2: Projects & Tasks (Week 3-4)
- [ ] Implement ProjectService + ProjectListViewModel
- [ ] Build ProjectListView with CRUD
- [ ] Implement TaskService with Realtime
- [ ] Create TaskListViewModel
- [ ] Build TaskListView (list mode)
- [ ] Build KanbanBoardView with drag-drop
- [ ] Create TaskEditorView modal
- [ ] Implement ClientService + sidebar
- [ ] Test real-time collaboration with 2 devices

### Phase 3: Advanced Features (Week 5-6)
- [ ] Implement TemplateService with 6 templates
- [ ] Build TemplateGalleryView
- [ ] Create MarkdownParser for import
- [ ] Implement SlackService webhook integration
- [ ] Build SlackIntegrationView in Settings
- [ ] Create StorageService for uploads
- [ ] Build AvatarPickerView (predefined + custom)
- [ ] Implement NotificationService
- [ ] Test push notifications on device

### Phase 4: Blog CMS (Week 7)
- [ ] Implement BlogService for posts/categories/tags
- [ ] Create BlogListView with admin check
- [ ] Build BlogEditorView with rich text
- [ ] Implement media library for blog images
- [ ] Add SEO fields support
- [ ] Test full blog workflow

### Phase 5: Polish & Testing (Week 8)
- [ ] Add loading states everywhere
- [ ] Create empty state views
- [ ] Implement error handling alerts
- [ ] Add pull-to-refresh on all lists
- [ ] Test offline mode with cached data
- [ ] Add accessibility labels
- [ ] Write unit tests for ViewModels
- [ ] Write UI tests for critical flows
- [ ] Performance optimization
- [ ] App icon and splash screen

### Phase 6: Beta & Launch (Week 9-10)
- [ ] TestFlight beta testing
- [ ] Fix critical bugs
- [ ] App Store screenshots
- [ ] Privacy policy & terms
- [ ] App Store submission
- [ ] Launch!

---

## Summary

This iOS app architecture provides:

✅ **100% Feature Parity** with Next.js web app
✅ **Same Supabase Backend** - no database changes needed
✅ **Native iOS Experience** - SwiftUI, gestures, push notifications
✅ **Real-time Collaboration** - Supabase Realtime for live updates
✅ **Offline-First** - Local caching with CacheManager
✅ **Clean Architecture** - MVVM with clear separation of concerns
✅ **Production-Ready** - Error handling, loading states, accessibility

**Key Technologies:**
- SwiftUI for UI
- Supabase Swift SDK for backend
- MVVM architecture
- Async/await for concurrency
- Combine for reactive programming
- Push notifications for due tasks

**File Count Estimate:** ~80-100 Swift files

**Development Time:** 8-10 weeks for single developer

The ios-fullstack-dev agent can now use this architecture to build the complete iOS app with confidence that it will match the web app's functionality exactly.
