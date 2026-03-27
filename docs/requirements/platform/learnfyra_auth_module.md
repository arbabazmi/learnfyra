# LearnFyra - Module 1: Authentication & Authorization (AUTH)

## Overview
This module provides secure authentication and authorization using AWS Cognito with Google OAuth and a Lambda Authorizer for API protection.

---

## 🎯 Objectives
- Secure user authentication using Google OAuth
- JWT-based API authentication
- Role-based authorization (basic for MVP)
- Environment isolation (dev, qa, prod)

---

## 🧱 Architecture

```
[Frontend]
   ↓
[Cognito Hosted UI]
   ↓
[Google OAuth]
   ↓
[Cognito JWT Tokens]
   ↓
[API Gateway]
   ↓
[Lambda Authorizer]
   ↓
[Backend Services]
   ↓
[DynamoDB Users Table]
```

---

## 🌍 Environments

Each environment is isolated:

- dev
- qa
- prod

Each includes:
- Cognito User Pool
- App Client
- Google OAuth App
- API Gateway

---

## 🔐 Authentication Flow

1. User clicks "Login with Google"
2. Redirect to Cognito Hosted UI
3. Cognito redirects to Google OAuth
4. Google authenticates user
5. Cognito issues JWT tokens
6. Frontend stores Access Token
7. Frontend calls API with token

---

## 🎫 Token Usage

Use **Access Token** for API calls.

Example header:
```
Authorization: Bearer <access_token>
```

---

## 🛡️ API Authentication (Lambda Authorizer)

### Flow
1. API request received
2. Lambda Authorizer extracts token
3. Validates JWT using Cognito public keys (JWKS)
4. Verifies:
   - Signature
   - Expiry
   - Issuer
   - Audience
5. Returns Allow/Deny policy

---

## 🔧 Lambda Authorizer Responsibilities

- Decode JWT
- Fetch JWKS from Cognito
- Validate token
- Attach user claims to request context

---

## 📦 Example Claims

```
{
  "sub": "user-id",
  "email": "user@gmail.com",
  "token_use": "access"
}
```

---

## 🗄️ User Data (DynamoDB)

Table: Users

Primary Key:
- PK: USER#<cognito_sub>

Attributes:
- email
- name
- role (default: student)
- provider = google
- created_at

---

## 🔄 First Login Flow

1. Extract user info from JWT
2. Check DynamoDB
3. If not exists → create user
4. Else → return existing user

---

## 🎭 Authorization (Basic)

Role-based (MVP):

- student (default)
- teacher (future)
- parent (future)

Authorization handled in backend using claims + DB lookup.

---

## 🔑 Google OAuth Setup

Create separate apps:

- learnfyra-dev
- learnfyra-qa
- learnfyra-prod

Redirect URLs:

- https://dev.learnfyra.com/callback
- https://qa.learnfyra.com/callback
- https://learnfyra.com/callback

---

## 🚨 Security Rules

- Never trust frontend data
- Always validate JWT
- Use Access Token (not ID token)
- Do not store sensitive data in JWT

---

## 🚀 Future Enhancements

- Add Microsoft/GitHub OAuth
- Add local authentication
- Add MFA
- Advanced RBAC

---

## ✅ Summary

- AWS Cognito handles authentication
- Google is the only OAuth provider (MVP)
- Lambda Authorizer validates JWT
- DynamoDB stores user metadata
- API Gateway secures endpoints

---

End of Document
