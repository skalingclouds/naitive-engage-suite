# Backend Structure Document

This document outlines the backend setup for the **naitive-engage-suite** project. It explains how everything is organized—from the server code and database to hosting, security, and monitoring—using everyday language so anyone can understand.

## 1. Backend Architecture

**Overall Design**
- We use Next.js (running on Node.js) as our backend framework.  Next.js gives us both server-side code and API endpoints in one place.  
- The code is written in TypeScript for clear definitions of data types, which helps catch errors early.
- We follow a **modular, feature‐sliced** structure: authentication, dashboard, sign-in, and sign-up each live in their own folders under `/app`.  

**How It Scales and Stays Fast**
- Next.js API routes deploy as **serverless functions** (via Vercel), which automatically spin up more copies when traffic grows.
- The modular layout lets teams work on one feature (e.g. authentication) without touching others, making updates safer and faster.
- TypeScript and clear folder separation reduce bugs and simplify maintenance over time.

## 2. Database Management

**Database Technology**
- We use a **relational database** (PostgreSQL) to store users and engagement metrics in structured tables.
- A hosted, managed service (AWS RDS) keeps the database online, updated, and backed up automatically.

**How Data Is Handled**
- We use an ORM (Prisma) to talk to the database in TypeScript rather than writing raw SQL everywhere.
- Database schema changes (adding a column, creating new tables) are managed through migration scripts, so every team member’s database stays in sync.
- Daily backups and automated failover protect against data loss.

## 3. Database Schema

### Human-Readable Overview
1. **Users**: Stores each user’s unique ID, email address, hashed password, and timestamps for when their account was created and last updated.  
2. **EngagementMetrics**: Records engagement data points for each user—what metric it is, its value, and when it was recorded.  
3. **Sessions** (optional): Tracks issued session tokens if you need to store refresh tokens or log out users server-side.

### SQL Schema (PostgreSQL)
```sql
-- 1. Users Table
CREATE TABLE users (
  id             SERIAL PRIMARY KEY,
  email          VARCHAR(255) UNIQUE NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Engagement Metrics Table
CREATE TABLE engagement_metrics (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric_type    VARCHAR(100) NOT NULL,
  metric_value   NUMERIC NOT NULL,
  recorded_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Sessions Table (Optional)
CREATE TABLE sessions (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token          VARCHAR(255) UNIQUE NOT NULL,
  expires_at     TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```  

## 4. API Design and Endpoints

We expose simple REST endpoints using Next.js API routes.  Each endpoint returns JSON and follows intuitive naming.

| Method | Path                   | Purpose                                            |
|--------|------------------------|----------------------------------------------------|
| POST   | /api/auth/signup       | Create a new user. Validates input, hashes password, stores record.  |
| POST   | /api/auth/login        | Verify credentials. Returns a signed JWT or session token.           |
| GET    | /api/dashboard/metrics | Retrieve the current user’s engagement data points. Requires valid token. |
| POST   | /api/dashboard/metrics | (Optional) Record a new engagement metric for the user.            |

**How It Works**
- The frontend calls these endpoints with `fetch()`, sending JSON in the request body.
- We validate inputs on both client and server sides to avoid bad data or attacks.
- After login, we issue a JWT stored in an HTTP-only cookie so JavaScript can’t read it directly, but the browser will send it on every request.

## 5. Hosting Solutions

**Next.js Backend (API + SSR)**
- Hosted on **Vercel**, which is made by the same team as Next.js.  
- Benefits:
  - Auto-scaling serverless functions handle spikes in traffic.
  - Built-in global CDN speeds up page loads anywhere in the world.
  - Zero-config deployments: push to Git, and Vercel updates the live site.

**Database**
- Hosted on **AWS RDS (PostgreSQL)**.
- Benefits:
  - Automated backups, patching, and database maintenance.
  - Multi-AZ (availability zone) setup for near-zero downtime.

## 6. Infrastructure Components

- **Global CDN (Vercel Edge Network):** Caches assets (JavaScript, CSS, images) at servers around the world, so users get fast page loads.
- **Serverless Functions (Vercel):** Our API routes run in isolated functions that spin up when needed and scale down when idle.
- **Caching Layer (Redis):** We use a managed Redis instance (e.g., AWS ElastiCache) to cache frequently requested dashboard data and sessions, reducing database load.
- **Load Balancing:** Vercel’s platform automatically distributes incoming requests across multiple function instances.

## 7. Security Measures

- **Authentication:**  
  - Passwords hashed with bcrypt before storing in the database.  
  - JWTs or sessions issued after login, stored in HTTP-only cookies.  
- **HTTPS Everywhere:** All traffic is encrypted with TLS by default on Vercel.  
- **Input Validation:** We validate and sanitize all incoming data on the server to prevent injection attacks.  
- **Environment Variables:** Secrets (database credentials, JWT secret) live outside the code in Vercel’s environment settings.  
- **CORS & Rate Limiting:** We restrict endpoints to our own frontend domain and limit repeated requests to prevent abuse.
- **Data Encryption at Rest:** The database service encrypts stored data by default.

## 8. Monitoring and Maintenance

- **Error Tracking:** Sentry watches for uncaught errors in both API routes and server-side rendering, alerting us immediately.  
- **Performance Metrics:** Vercel’s built-in analytics show build times, function latency, and bandwidth usage.  
- **Database Health:** AWS CloudWatch monitors RDS CPU, memory, connections, and triggers alarms if thresholds are exceeded.  
- **Backup & Recovery:** Daily automated backups of the database, with a 7-day retention window. We test recovery procedures monthly.  
- **Dependency Updates:** Dependabot (or a similar tool) automatically opens pull requests to bump library versions. We review and deploy regularly.

## 9. Conclusion and Overall Backend Summary

The **naitive-engage-suite** backend is built on a modern, modular Next.js setup, using TypeScript for type safety. We store user and engagement data in a managed PostgreSQL database (AWS RDS) and accelerate responses with a Redis cache. Hosting on Vercel provides global performance and automatic scaling of our API routes, while AWS handles robust data storage and backups. Security best practices—strong password hashing, HTTPS, input validation, and environment-stored secrets—protect user information. Finally, continuous monitoring and automation ensure the system stays healthy, up-to-date, and ready to scale as more users join.

With this structure, the backend can grow gracefully, remain reliable under load, and provide fast, secure experiences for end users.