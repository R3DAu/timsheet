# Timesheet System - Database Schema

## Overview
This document outlines the database schema for the timesheet management system.

## Entities

### Users (Authentication)
- `id` - Primary key
- `email` - Unique, required
- `password_hash` - Hashed password
- `name` - Full name
- `is_admin` - Boolean
- `created_at`, `updated_at`

### Companies
- `id` - Primary key
- `name` - Company name
- `is_billable` - Whether this company is billed
- `created_at`, `updated_at`

### Employees
- `id` - Primary key
- `user_id` - Foreign key to Users
- `first_name`, `last_name`
- `email`, `phone`
- `preset_addresses` - JSON field for common locations
  ```json
  {
    "home": "123 Main St, City",
    "work_place_1": "456 Office Blvd",
    "work_place_2": "789 Site Ave",
    "school_1": "321 School Rd"
  }
  ```
- `created_at`, `updated_at`

### EmployeeIdentifiers
Multiple employee IDs per employee for different systems/integrations
- `id` - Primary key
- `employee_id` - Foreign key to Employees
- `identifier_type` - Type of identifier (e.g., "payroll", "hr_system", "contractor_id")
- `identifier_value` - The actual ID value
- `company_id` - Foreign key to Companies (optional)
- `created_at`, `updated_at`

### Roles
- `id` - Primary key
- `name` - Role name (e.g., "Specialist Technician", "Local Technician")
- `company_id` - Foreign key to Companies
- `pay_rate` - Decimal, hourly rate
- `created_at`, `updated_at`

### EmployeeRoles (Junction table)
Employees can have multiple roles per company
- `id` - Primary key
- `employee_id` - Foreign key to Employees
- `role_id` - Foreign key to Roles
- `company_id` - Foreign key to Companies
- `is_active` - Boolean
- `created_at`, `updated_at`

### Timesheets
- `id` - Primary key
- `employee_id` - Foreign key to Employees
- `week_starting` - Date
- `week_ending` - Date
- `status` - Enum: OPEN, INCOMPLETE, SUBMITTED, AWAITING_APPROVAL, APPROVED, LOCKED, UNLOCKED, PROCESSED
- `submitted_at` - Timestamp
- `approved_at` - Timestamp
- `approved_by` - Foreign key to Users (nullable)
- `created_at`, `updated_at`

### TimesheetEntries
- `id` - Primary key
- `timesheet_id` - Foreign key to Timesheets
- `entry_type` - Enum: TRAVEL, GENERAL
- `date` - Date of entry
- `hours` - Decimal, hours worked
- `role_id` - Foreign key to Roles
- `company_id` - Foreign key to Companies
- `status` - Enum: OPEN, INCOMPLETE, SUBMITTED, AWAITING_APPROVAL, APPROVED, LOCKED, UNLOCKED, PROCESSED
- `notes` - Text field
- `travel_from` - Text (for travel entries)
- `travel_to` - Text (for travel entries)
- `distance` - Decimal (kilometers/miles, for travel entries)
- `created_at`, `updated_at`

### TimesheetApprovers
- `id` - Primary key
- `company_id` - Foreign key to Companies
- `user_id` - Foreign key to Users
- `email` - Email address
- `created_at`, `updated_at`

### PlaceCache
Google Maps API result caching to reduce API calls
- `id` - Primary key
- `place_name` - Search term/name
- `address` - Full formatted address
- `latitude` - Decimal
- `longitude` - Decimal
- `google_place_id` - Google's place ID
- `created_at`, `updated_at`

## Status Workflow

### Timesheet Status Flow
1. OPEN → User can add/edit entries
2. INCOMPLETE → Missing required information
3. SUBMITTED → User submits for approval
4. AWAITING_APPROVAL → Waiting for approver action
5. APPROVED → Approved by manager
6. LOCKED → No further edits allowed
7. PROCESSED → Processed for payroll
8. UNLOCKED → Admin can unlock for corrections

### Entry Status Flow
Similar to timesheet status, entries can have their own status to track granular approval states.
