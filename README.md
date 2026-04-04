# Ace Grid API

Ace Grid API is a backend service for managing courses, exams, questions, and test attempts. It acts as the core engine powering the content delivery and progress tracking features for users, including free vs gated content evaluation and an admin management interface.

Built with **Node.js**, **Express**, **TypeScript**, and **MongoDB**, this API uses **Zod** for schema validation and **Mongoose** for data modeling.

---

## 🛠 Tech Stack

- **Runtime:** Node.js (via `tsx` in development, compiled using `tsc` in production)
- **Framework:** Express.js
- **Database:** MongoDB + Mongoose
- **Language:** TypeScript (with `@/` path alias support using `tsc-alias`)
- **Validation:** Zod
- **Authentication:** JSON Web Tokens (JWT) + bcryptjs

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [MongoDB](https://www.mongodb.com/) (Local instance or Atlas URI)

### 2. Installation
Clone the repository and install the dependencies:
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root of the project with the following required environment variables (see `src/types/index.ts` envSchema for defaults):

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/prep-ui
JWT_SECRET=super_secret_jwt_key
JWT_EXPIRES_IN=7d
FREE_QUESTIONS_COUNT=5
CORS_ORIGIN=*
NODE_ENV=development
```

### 4. Running the Development Server
This project uses `env-cmd` and `tsx` to load variables and execute TypeScript dynamically during development.

```bash
npm run dev
```

### 5. Seeding the Database
To populate the database with initial sample data for testing, run:
```bash
npm run seed
```

### 6. Building for Production
The project uses `tsc` and `tsc-alias` to compile the app into standard JavaScript to the `dist` directory:

```bash
npm run build
npm start
```

---

## 📡 API Reference

Below is a detailed list of all endpoints provided by the API.

> Note: All authenticated routes require the `Authorization: Bearer <token>` header. Admin routes require an account with `role: "admin"`.

### Health
| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| `GET` | `/health` | Verify if the API server is up and running. | No |

### Auth (`/api/auth`)
| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| `POST` | `/register` | Register a new user account. Required body: `name, email, password`. | No |
| `POST` | `/login` | Authenticate an existing user and return a JWT and user object. | No |
| `GET` | `/me` | Get the currently logged-in user's profile information. | **Yes** |

### Courses (`/api/courses`)
| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| `GET` | `/` | Get a paginated list of courses. Accepts query params: `category`, `page`, `limit`. | No |
| `GET` | `/:slug` | Get full course details, including the exams belonging to it, using the URL slug. | No |

### Exams (`/api/exams`)
| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| `GET` | `/?courseId=...&page=1&limit=20` | List basic info (without questions), optionally filtered by `courseId`. Supports optional pagination params. | No |
| `GET` | `/:id` | Get exam details alongside questions. Automatically redacts the exact answer and explanation on non-free questions if the user hasn't purchased it. | **Yes** |

### Attempts (`/api/attempts`)
| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| `GET` | `/me` | View your own history of previous exam attempts. | **Yes** |
| `GET` | `/:id` | View a specific attempt's previous answers and score. | **Yes** |
| `POST` | `/` | Start a new attempt on an exam. If an `in_progress` attempt exists, it resumes it instead. Body: `{ examId }`. | **Yes** |
| `PATCH` | `/:id/submit` | Submit your final answers to a test to calculate your `score`, finalize it, and set the status to `completed`. Body requires `answers` array. | **Yes** |

### Admin API (`/api/admin`)
**Important:** All routes below require BOTH standard authentication AND admin clearance (`adminGuard`).

#### Admin Courses
| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/courses` | Create a new course. |
| `GET` | `/courses/:id` | Fetch one course by id, including exams in that course. |
| `PATCH` | `/courses/:id` | Update an existing course (partial updates allowed). |
| `PUT` | `/courses/:id` | Replace/update an existing course with the full payload. |
| `DELETE` | `/courses/:id` | Delete a course. **Warning**: Cascades down and deletes nested Exams and Questions. |

#### Admin Exams
| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/exams` | Create a new exam assigned to a specific `courseId`. |
| `PATCH` | `/exams/:id` | Update an existing exam's details. |
| `DELETE` | `/exams/:id` | Delete an exam. **Warning**: Cascades down to delete nested Questions. |
| `GET` | `/exams/:id/random` | Fetch a preview of randomized questions from an exam. Accepts `?count=5&freeOnly=false`. |

#### Admin Questions
| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/questions` | Create a single question for an exam. Auto-assigns an order value. |
| `POST` | `/questions/bulk` | Create multiple questions simultaneously for an exam. Body requires `{ examId, questions: [...] }`. |
| `PATCH` | `/questions/:id` | Edit an existing question, such as toggling `isFree`. |
| `DELETE` | `/questions/:id` | Remove a particular question from the database completely. |

---

## 🚦 Error Handling & Rate Limiting

The API implements a global standardized error handler returning a uniform JSON envelope:

```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {}
  }
}
```

Additionally, standard rate limiting is enforced on all connections (200 requests per 15 minutes max per IP window) using `express-rate-limit`.
