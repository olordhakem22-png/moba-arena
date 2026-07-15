# MOBA Arena API Documentation

## Base URL
```
http://localhost:4000/api
```

## Authentication

All protected endpoints require a Bearer token:
```
Authorization: Bearer <access_token>
```

## Endpoints

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create new account |
| POST | `/auth/login` | Sign in |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Sign out |
| GET | `/auth/me` | Get current user |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/me` | Get my profile |
| GET | `/users/me/profile` | Get detailed profile |
| PUT | `/users/me` | Update profile |
| GET | `/users/:id` | Get user by ID |
| GET | `/users/:id/profile` | Get user profile |

### Champions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/champions` | List all champions |
| GET | `/champions/:id` | Get champion details |
| GET | `/champions/:id/abilities` | Get champion abilities |
| GET | `/champions/:id/skins` | Get champion skins |
| GET | `/champions/:id/mastery` | Get my mastery |

### Matches

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/matches` | List my matches |
| GET | `/matches/history` | Match history |
| GET | `/matches/:id` | Get match details |
| POST | `/matches/custom/create` | Create custom match |
| POST | `/matches/:id/join` | Join custom match |

### Store

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/store/items` | Browse store items |
| GET | `/store/inventory` | My inventory |
| POST | `/store/purchase` | Purchase item |

### Social

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/social/friends` | My friends list |
| POST | `/social/friends/request` | Send friend request |
| POST | `/social/friends/request/:id/accept` | Accept request |
| GET | `/social/channels` | Chat channels |
| GET | `/social/channels/:id/messages` | Channel messages |
| GET | `/social/online` | Online players |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/users` | User management |
| GET | `/admin/stats` | Server statistics |
| POST | `/admin/ban` | Ban user |
| POST | `/admin/unban` | Unban user |
| GET | `/admin/reports` | View reports |
