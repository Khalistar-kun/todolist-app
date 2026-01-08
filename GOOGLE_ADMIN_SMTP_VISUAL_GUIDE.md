# Google Admin Console SMTP Settings - Visual Guide

## 1. Initial Login & Navigation

### What You'll See First
```
Google Admin Console
_________________________
[Search console...    ] 🔍
_________________________
Dashboard | Directory | Devices | Apps | Security
```

### Step 1: Access Admin Console
- Go to: **admin.google.com**
- Look for this exact text in your browser tab: **"Google Admin Console"**
- Sign in with your administrator email

### Step 2: Use Search Bar (Quickest Method)
**Visual Location**: Top center of the page
```
[ Search apps, settings, and users...    ] 🔍
```

**Type these exact phrases in the search bar:**
- `"SMTP"` (first try)
- If no results: `"Email routing"`
- If still no results: `"Gmail settings"`

**What successful search looks like:**
```
🔍 Results for "SMTP"
┌─────────────────────────────┐
│ Apps                         │
│  └─ Gmail                    │
│      └─ SMTP relay service   │
└─────────────────────────────┘
```

## 2. Alternative Navigation Path (Manual Method)

### Apps Menu Navigation
**Look for this exact text in the left sidebar:**
```
🏠 Home
👥 Directory
📱 Devices
🔌 Apps         ← Click this
🔒 Security
📊 Reports
⚙️ Admin
```

**When you click "Apps", you should see:**
```
Apps
├─ Google Workspace
│  ├─ Gmail
│  ├─ Calendar
│  ├─ Drive
│  └─ ...
├─ Additional Google services
└─ SaaS apps
```

**Click on: "Gmail"**
- Text should appear exactly as: **"Gmail"**
- NOT "Email", NOT "Google Mail", NOT "Messaging"

## 3. Gmail Settings Screen

### What the Gmail Page Looks Like
**Header text you should see:**
```
Gmail settings
─────────────────────────────────────
User settings | Service status | Routing | Compliance
```

**Look for these exact tabs:**
- **"User settings"** (usually selected by default)
- **"Service status"**
- **"Routing"** ← **This is often where SMTP settings are**
- **"Compliance"**

### Click on the "Routing" Tab
**Button/Tab text should be exactly:**
```
[ User settings ] [ Service status ] [ Routing ] [ Compliance ]
                                                       ↑
                                                   Click here
```

## 4. Finding SMTP Settings in Routing

### What the Routing Section Contains
**Look for these exact section headers:**
```
Routing
├─ Email routing
├─ SMTP relay service    ← **This is what you're looking for**
├─ Gateway
└─ Routing rules
```

### SMTP Relay Service Section
**Exact button/link text to click:**
```
📧 SMTP relay service
[Configure] [Manage settings] [Edit]
```

**If you see:**
```
[ Add another ] [ Configure SMTP relay service ]
```
Click **"Configure SMTP relay service"** or **"Add another"**

## 5. SMTP Configuration Screen

### What the SMTP Configuration Page Looks Like
**Page header should read:**
```
SMTP relay service settings
─────────────────────────────────────
```

**You should see these exact options:**
```
☑️ Allow selected routes to send email using SMTP relay service

Routing options:
○ Only send mail from the specified domains
○ Only accept mail from specified IP addresses
○ Only accept mail from specified reverse DNS records

Allowed senders:
[ Add        ] [ Remove ]

Authentication:
☑️ Require SMTP Authentication
□ Treat messages as authenticated if they are sent from:
    ○ [ Specified IP addresses ]
    ○ [ Specified domains ]

Encryption:
☑️ Require TLS encryption
□ Require message to be signed (if available)
```

### Common Button Text Variations
**If the interface has been updated, look for these alternatives:**

**Instead of "Configure":**
- [ Manage ]
- [ Settings ]
- [ Edit configuration ]
- [ Set up SMTP ]

**Instead of "Routing":**
- [ Email routing ]
- [ Mail routing ]
- [ Message routing ]
- [ Delivery routing ]

## 6. Search Bar Shortcuts & Direct Links

### Direct Search Terms
**Type exactly these phrases in the top search bar:**

1. **"SMTP relay"**
   ```
   Search: SMTP relay
   Results should show:
   - Gmail > SMTP relay service
   - Apps > Google Workspace > Gmail > SMTP relay service
   ```

2. **"Gmail routing"**
   ```
   Search: Gmail routing
   Results should show:
   - Gmail > Routing settings
   - Apps > Google Workspace > Gmail > Routing
   ```

3. **"Email routing"**
   ```
   Search: Email routing
   Results should show:
   - Gmail > Email routing settings
   ```

### URL Direct Access
**If you have the exact URL structure, you can go directly to:**
```
admin.google.com/ac/apps/gmail/smtp-relay
```

## 7. If Options Are Missing

### Check for These Issues

#### 1. Insufficient Permissions
**What you might see:**
```
⚠️ You don't have permission to perform this action
Contact your administrator
```

#### 2. License Requirements
**Look for these messages:**
```
💡 This feature requires:
- Google Workspace Business Standard
- Google Workspace Business Plus
- Enterprise plans
```

#### 3. Service Not Enabled
**Check the Service Status tab:**
```
Service status
┌─────────────────────────┐
│ Gmail: ✅ Enabled       │
│ SMTP relay: ❌ Disabled │ ← Enable this first
└─────────────────────────┘
```

## 8. Alternative Interface Versions

### Classic Admin Console (Older UI)
**If you see the older interface:**
```
Google Admin Console (Classic)
├─ Users
├─ Groups
├─ Chrome devices
├─ Apps
│  └─ G Suite
│     └─ Gmail
│        └─ Advanced settings ← SMTP settings might be here
└─ Admin
```

**Look for these specific section names:**
- "Advanced settings" instead of "Routing"
- "Email routing" instead of "SMTP relay service"
- "SMTP settings" instead of "SMTP relay service"

### New Admin Console (Recent UI)
**If you see the newer interface:**
```
Navigation
├─ Home
├─ Directory
├─ Devices
├─ Apps
│  └─ Google Workspace
│     └─ Gmail
│        ├─ General settings
│        ├─ User settings
│        ├─ Routing ← SMTP settings here
│        └─ Compliance
├─ Security
└─ Admin
```

## 9. Visual Indicators to Look For

### Icons and Symbols
**These icons indicate you're in the right place:**
- 📧 Mail/Email icon next to SMTP settings
- 🔄 Routing icon next to email routing options
- ⚙️ Settings gear icon for configuration options
- ✅ Checkmarks for enabled features
- 🔒 Lock icon for security settings

### Color Coding
**Visual cues to help identify sections:**
- **Blue buttons**: Primary actions (Configure, Save, Add)
- **Gray text**: Disabled features (requires upgrade)
- **Green indicators**: Enabled services
- **Yellow warnings**: Configuration needed

## 10. Troubleshooting Visual Guide

### If You Can't Find "Apps" in the Menu
**Look for these alternatives:**
- "Services" instead of "Apps"
- "Google Workspace" at the top level
- "G Suite" (older name)
- Three horizontal lines (☰) to expand hidden menu

### If the Search Bar Doesn't Work
**Try these alternatives:**
- Refresh the page and try again
- Use incognito/private browser mode
- Try a different browser
- Navigate manually through the menu structure

### If Settings Grayed Out
**Look for these specific messages:**
```
⚠️ This setting is managed by your organization
⚠️ Contact your super administrator
⚠️ Upgrade required for this feature
```

## 11. Final Confirmation

### When You've Found the Right Place
**You should see a page that contains ALL of these elements:**
1. **Page title**: "Gmail settings" or "Email routing"
2. **Section**: "SMTP relay service" or "SMTP settings"
3. **Configuration options**: Authentication, encryption, allowed senders
4. **Save button**: At the bottom or top of the settings
5. **Help link**: Usually in the top-right corner

**The save button text should be exactly one of these:**
- [ Save ]
- [ Save changes ]
- [ Update settings ]
- [ Apply ]

### Success Indicators
**After configuring, you should see:**
```
✅ Settings saved successfully
📧 SMTP relay service is now active
```