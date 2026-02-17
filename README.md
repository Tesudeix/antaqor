# Antaqor Community

A modern community platform built with **Next.js**, **MongoDB**, and **Tailwind CSS**.

**Server:** `68.183.184.111`

## Features

- User authentication (sign up / sign in)
- Create, view, and delete posts
- Like and comment on posts
- User profiles with editable bio
- Responsive mobile-first design
- Dark mode support

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **MongoDB 7** + Mongoose
- **NextAuth.js** (JWT-based credentials auth)
- **Tailwind CSS v4**

## Local Development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Digital Ocean

See **[DEPLOY.md](./DEPLOY.md)** for the full step-by-step guide.

Quick summary:
1. Push code to GitHub
2. SSH into `68.183.184.111`
3. Run `bash scripts/deploy.sh`
4. Clone repo, install, build, start with PM2
5. Configure Nginx

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/[...nextauth]` | NextAuth sign in |
| GET | `/api/posts` | List posts (paginated) |
| POST | `/api/posts` | Create post |
| GET | `/api/posts/:id` | Get single post |
| DELETE | `/api/posts/:id` | Delete post (owner only) |
| POST | `/api/posts/:id/like` | Toggle like |
| GET | `/api/posts/:id/comments` | List comments |
| POST | `/api/posts/:id/comments` | Add comment |
| GET | `/api/users/:id` | Get user profile |
| PUT | `/api/users/:id` | Update profile (owner only) |

## License

MIT
