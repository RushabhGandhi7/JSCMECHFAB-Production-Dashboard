# 🚫 PROJECT GUARDIAN — DO NOT BREAK SYSTEM

## PROJECT: JSC MECHFAB PRODUCTION SYSTEM

This is a production-grade Mechanical ERP system.

---

## 🔒 CRITICAL RULES (NON-NEGOTIABLE)

1. NEVER modify existing working features unless explicitly asked
2. NEVER restructure folders or rename core files
3. NEVER replace authentication system
4. NEVER remove role-based access control
5. NEVER mix experimental UI into production UI
6. ALWAYS preserve ADMIN vs CLIENT restrictions

---

## 🧠 CURRENT SYSTEM STATE

### Versions:

- v2 → Stable production UI (PRIMARY BASE)
- v5 → Experimental (ONLY navbar used)
- v6 → FINAL build (separate project on Desktop)

---

## 🏗️ CORE FEATURES IMPLEMENTED

- Client-based access control (multi-tenant)
- Admin + Client roles
- Project tracking system
- Production stages & timeline
- Auto date logic (28-day cycle)
- Soft delete system
- User management (admin only)
- Client management (admin only)

---

## 🔐 ROLE RULES

### ADMIN:

- Full access (CRUD everything)

### CLIENT:

- VIEW ONLY
- Cannot edit, create, delete

---

## 🎯 CURRENT UI DECISION

- WHITE industrial theme (NOT dark mode)
- Clean ERP layout
- High clarity, low clutter

---

## ⚠️ KNOWN DESIGN DECISIONS

- NO manual date inputs anywhere
- Project creation uses system time
- Project card layout must NOT change drastically
- Navbar from v5 is reused ONLY for top-right menu

---

## 🧩 DO NOT TOUCH WITHOUT PERMISSION

- prisma/schema.prisma (unless required)
- lib/auth.ts
- lib/services/*
- API routes for auth and project

---

## 🧪 SAFE CHANGES ALLOWED

- UI polish
- Small UX improvements
- Bug fixes
- Performance improvements

---

## 🚨 BEFORE ANY CHANGE

Agent must:

1. Explain what will change
2. Confirm it will NOT break existing logic
3. Proceed only after validation

---

## 📌 FINAL GOAL

Stable, production-ready ERP system  
NOT a redesign playground

---

If unsure → DO NOTHING and ask.