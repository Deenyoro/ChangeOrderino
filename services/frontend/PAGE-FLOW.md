# 📱 Complete Page Flow & Navigation

## 🗺️ Site Map

```
Authentication (Keycloak SSO)
│
├─ Dashboard (/)
│  ├─ Stats: Active Projects, Pending Review, Sent to GC, Approved
│  └─ Quick Actions → Projects, TNM Tickets, Create TNM
│
├─ Projects (/projects)
│  ├─ List all projects (search, filter active/archived)
│  ├─ [New Project] (/projects/new)
│  │  └─ Form → Create → Return to list
│  │
│  └─ [Click Project] (/projects/:id)
│     ├─ View details, stats, TNM list
│     ├─ [Edit] → Modal → Save
│     ├─ [Archive/Restore] → Confirm → Update
│     ├─ [Delete] → Confirm → Delete → Return to list
│     └─ [New TNM Ticket] → /tnm/create?project_id=:id
│
└─ TNM Tickets (/tnm-tickets)
   ├─ List all tickets (search, filter by status/project)
   ├─ Table: RFCO#, Title, Project, Proposal Date, Proposal $, Approved $, Response Date, Status
   │
   ├─ [Create TNM] (/tnm/create)
   │  ├─ Select job → Auto-fill project #
   │  ├─ Fill header (title, date, submitter)
   │  ├─ Add labor items (type → auto rate)
   │  ├─ Add material items (qty × price)
   │  ├─ Add equipment items (qty × price)
   │  ├─ Add subcontractor items (amount)
   │  ├─ See real-time OH&P summary
   │  ├─ Add signature (iPad pad or photo)
   │  ├─ Add photos (camera/library)
   │  └─ [Submit for Review] → Saves as pending_review → /tnm-tickets
   │
   └─ [Click TNM] (/tnm/:id)
      ├─ View all details (header, line items, totals, attachments)
      ├─ View email tracking (sent count, last sent, reminders)
      │
      ├─ IF status = draft:
      │  └─ [Submit for Review] → pending_review
      │
      ├─ IF status = pending_review:
      │  ├─ [Edit OH&P] → Modal → Adjust %s → Save
      │  ├─ [Mark Ready to Send] → ready_to_send
      │  └─ [Edit] → /tnm/:id/edit (future)
      │
      ├─ IF status = ready_to_send OR pending_review:
      │  └─ [Send to GC] → Modal:
      │     ├─ Enter GC email
      │     ├─ Preview (PDF, link details)
      │     └─ [Send Email] → sent
      │        ├─ Backend generates PDF
      │        ├─ Backend sends email with PDF + approval link
      │        ├─ Updates: email_sent_count++, last_email_sent_at
      │        └─ Status → sent
      │
      ├─ IF status = sent OR viewed:
      │  └─ [Remind Now] → Resends email
      │     ├─ Updates: reminder_count++, last_reminder_sent_at
      │     └─ Status stays sent/viewed
      │
      ├─ [Download PDF] → Generates & downloads
      └─ [Delete] → Confirm → Delete → /tnm-tickets

PUBLIC (No Authentication):
│
└─ GC Approval (/approve/:token)
   ├─ Validate token
   │  ├─ IF invalid → Show error
   │  ├─ IF expired → Show expired message
   │  └─ IF already responded → Show confirmation
   │
   ├─ IF valid:
   │  ├─ Show project info
   │  ├─ Show TNM details (title, dates, amount)
   │  ├─ Show description
   │  ├─ Show all line items (read-only tables)
   │  ├─ Show OH&P summary
   │  │
   │  ├─ [Approve All] → Marks all items approved
   │  ├─ [Deny All] → Marks all items denied
   │  ├─ OR approve/deny individual line items
   │  │
   │  ├─ Add optional GC comment
   │  │
   │  └─ [Submit Response]
   │     ├─ Backend records response
   │     ├─ Updates: response_date, approved_amount
   │     ├─ Status → approved / denied / partially_approved
   │     └─ Show success confirmation
   │
   └─ Success → Thank you message
```

---

## 🎯 User Journeys

### Journey 1: Office Admin Sets Up New Project

1. Navigate to `/projects`
2. Click "New Project"
3. Fill form:
   - Name: "Main Street Office Building"
   - Number: "PROJ-2024-001"
   - GC Email: "gc@example.com"
   - Default OH&P: 15%, 20%, 10%, 5%
4. Click "Create Project"
5. Redirected to `/projects` list
6. See new project in list

**Time:** ~2 minutes

---

### Journey 2: Foreman Creates TNM on iPad

1. Navigate to `/tnm/create`
2. Select job from dropdown → Project # auto-fills
3. Enter title: "Additional framing work"
4. Add labor items:
   - "Framing work" - 16 hrs - Carpenter → $1,200 subtotal
   - "Prep work" - 8 hrs - Laborer → $456 subtotal
5. Add materials:
   - "2x4 lumber" - 100 ft @ $3.50 → $350 subtotal
6. See real-time summary update:
   - Labor: $1,656 + 20% = $1,987.20
   - Material: $350 + 15% = $402.50
   - **Total: $2,389.70**
7. Tap "Add GC Signature"
8. Draw signature on iPad pad
9. Tap "Save Signature"
10. Optionally add photos
11. Tap "Submit for Review"
12. Success toast appears
13. Redirected to `/tnm-tickets`

**Time:** ~5-10 minutes (depending on line items)

---

### Journey 3: Admin Reviews & Sends to GC

1. Navigate to `/tnm-tickets`
2. See new ticket in "Pending Review" status
3. Click TNM number to open detail
4. Review all line items
5. Click "Edit OH&P" (optional)
   - Adjust percentages if needed
   - Save changes
6. Click "Mark Ready to Send"
7. Click "Send to GC"
8. Modal opens:
   - GC email pre-filled
   - Preview details
9. Click "Send Email"
10. Backend:
    - Generates PDF
    - Sends email with PDF + approval link
    - Updates status to "sent"
11. Success toast appears
12. Status badge now shows "Sent"
13. Email tracking shows: "Times Sent: 1, Last Sent: Just now"

**Time:** ~2-3 minutes

---

### Journey 4: GC Approves via Email Link

1. GC receives email from changeorder@treconstruction.net
2. Email contains:
   - Subject: "RFCO TNM-2024-001 – Main Street Office Building"
   - PDF attachment
   - Secure approval link
3. GC clicks link → Opens `/approve/{token}` in browser
4. Page loads (no login required):
   - Project info displayed
   - TNM details shown
   - All line items in tables
   - OH&P summary visible
5. GC reviews all items
6. Clicks "Approve All"
7. Optionally adds comment: "Approved as submitted"
8. Clicks "Submit Response"
9. Backend:
   - Records response_date
   - Calculates approved_amount
   - Updates status to "approved"
10. Success screen appears: "Response Submitted - Thank you!"

**Time:** ~3-5 minutes

---

### Journey 5: Admin Sends Reminder

1. Navigate to `/tnm/:id` (ticket in "sent" status)
2. See email tracking:
   - "Times Sent: 1"
   - "Last Sent: 3 days ago"
   - "Reminders Sent: 0"
3. Click "Remind Now"
4. Backend:
   - Sends reminder email with PDF + link
   - Updates reminder_count++
   - Updates last_reminder_sent_at
5. Success toast appears
6. Email tracking updates:
   - "Times Sent: 2"
   - "Reminders Sent: 1"
   - "Last Sent: Just now"

**Time:** ~30 seconds

---

## 🔄 Status Workflow Diagram

```
┌─────────┐
│  DRAFT  │ ← Foreman creates TNM
└────┬────┘
     │ [Submit for Review]
     ↓
┌──────────────────┐
│ PENDING_REVIEW   │ ← Admin reviews
└────┬─────────────┘
     │ [Mark Ready to Send]
     ↓
┌──────────────────┐
│ READY_TO_SEND    │ ← Admin can send
└────┬─────────────┘
     │ [Send to GC]
     ↓
┌─────────┐
│  SENT   │ ← Email sent, waiting for GC
└────┬────┘
     │ (GC opens link)
     ↓
┌─────────┐
│ VIEWED  │ ← GC viewed, not responded
└────┬────┘
     │ (GC submits response)
     ↓
     ├─ All approved ──→ ┌──────────┐
     │                   │ APPROVED │
     │                   └──────────┘
     │
     ├─ All denied ────→ ┌─────────┐
     │                   │ DENIED  │
     │                   └─────────┘
     │
     └─ Partial ───────→ ┌────────────────────────┐
                         │ PARTIALLY_APPROVED     │
                         └────────────────────────┘

Manual Actions (Admin):
┌────────────┐
│ CANCELLED  │ ← Admin cancels
└────────────┘
```

---

## 📊 Dashboard Statistics

```
┌───────────────────────────────────────────────────────┐
│                      DASHBOARD                        │
├───────────────────────────────────────────────────────┤
│                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   Active    │  │   Pending    │  │  Sent to GC │ │
│  │  Projects   │  │    Review    │  │             │ │
│  │             │  │              │  │             │ │
│  │     12      │  │      3       │  │      5      │ │
│  └─────────────┘  └──────────────┘  └─────────────┘ │
│                                                       │
│  ┌─────────────┐                                     │
│  │  Approved   │                                     │
│  │             │                                     │
│  │     18      │                                     │
│  └─────────────┘                                     │
│                                                       │
│  ┌────────────────────────────────────────────────┐  │
│  │ Quick Actions:                                 │  │
│  │  → View Projects                               │  │
│  │  → TNM Tickets                                 │  │
│  │  → Create New TNM                              │  │
│  └────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────┘
```

---

## 🎨 Color-Coded Status Guide

| Status | Color | Badge | When |
|--------|-------|-------|------|
| Draft | Gray | `draft` | Foreman saved, not submitted |
| Pending Review | Yellow | `pending_review` | Submitted, awaiting admin review |
| Ready to Send | Blue | `ready_to_send` | Admin approved, ready to email |
| Sent | Purple | `sent` | Email sent to GC |
| Viewed | Indigo | `viewed` | GC opened approval link |
| Partially Approved | Orange | `partially_approved` | Some items approved, some denied |
| Approved | Green | `approved` | All items approved by GC |
| Denied | Red | `denied` | All items denied by GC |
| Cancelled | Gray (muted) | `cancelled` | Admin cancelled |

---

## 🔐 Access Control

| Role | Dashboard | Projects | Create TNM | Review TNM | Send to GC | Approve (GC) |
|------|-----------|----------|------------|------------|------------|--------------|
| **Admin** | ✅ | ✅ Create/Edit/Delete | ✅ | ✅ | ✅ | N/A |
| **Office Staff** | ✅ | ✅ View/Edit | ✅ | ✅ | ✅ | N/A |
| **Project Manager** | ✅ | ✅ View/Edit | ✅ | ✅ | ✅ | N/A |
| **Foreman** | ✅ | ❌ View only | ✅ | ❌ View only | ❌ | N/A |
| **GC (Public)** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (token) |

---

## 📱 Responsive Breakpoints

| Screen | Width | Layout |
|--------|-------|--------|
| **Mobile** | < 768px | Single column, stacked, full-width buttons |
| **Tablet/iPad** | 768-1024px | 2 columns, larger touch targets, adapted spacing |
| **Desktop** | > 1024px | Multi-column, sidebars, efficient use of space |

**iPad Portrait (768px):** ✅ Optimized for TNM creation
**iPad Landscape (1024px):** ✅ Shows summary sidebar
**Desktop (1920px):** ✅ Wide layout with sticky sidebar

---

## ✅ Navigation Quick Reference

| From | To | Action |
|------|-------|--------|
| Anywhere | Dashboard | Click logo or "Dashboard" in sidebar |
| Dashboard | Projects | Click "Projects" card or sidebar |
| Dashboard | TNM Tickets | Click "TNM Tickets" card or sidebar |
| Dashboard | Create TNM | Click "Create TNM" card or sidebar |
| Projects List | New Project | Click "New Project" button |
| Projects List | Project Detail | Click project card |
| Project Detail | Edit | Click "Edit Project" button → Modal |
| Project Detail | Create TNM | Click "New TNM Ticket" button |
| TNM List | Create TNM | Click "New TNM Ticket" button |
| TNM List | TNM Detail | Click TNM number |
| TNM Detail | Edit | Click "Edit" button |
| TNM Detail | Send | Click "Send to GC" button |
| Email Link | GC Approval | Click secure link in email |

---

**Perfect Navigation, Complete Workflow, Amazing UX!** 🎉
