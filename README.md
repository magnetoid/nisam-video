# 🎥 Nisam Video

<div align="center">

![Project Status](https://img.shields.io/badge/Status-Active-success?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Stack-PERN-orange?style=for-the-badge)
![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen?style=for-the-badge)

**An AI-Powered, Netflix-Style Video Hub Aggregating Content from Across the Web.**

[View Demo](https://nisam.video) · [Report Bug](https://github.com/magnetoid/nisam-video/issues) · [Request Feature](https://github.com/magnetoid/nisam-video/issues)

</div>

---

## ✨ Overview

**Nisam Video** is a cutting-edge video aggregation platform designed to deliver a premium, **Netflix-like user experience**. It leverages **Artificial Intelligence** to automatically categorize, tag, and organize content from platforms like **YouTube** and **TikTok**, creating a seamless and immersive viewing environment.

Built with performance, scalability, and UX in mind, it features a **Progressive Web App (PWA)** architecture, robust **admin tools**, and a powerful **recommendation engine**.

---

## 🚀 Key Features

### 🎬 **Immersive Viewing Experience**
*   **Netflix-Style Hero Slider**: Auto-rotating, dynamic hero banner with video previews.
*   **Smart "Similar Videos"**: AI-driven recommendation engine using category, tags, and channel affinity.
*   **Responsive & Fast**: Mobile-first design with lazy loading and optimized assets.
*   **PWA Support**: Installable on mobile/desktop with offline capabilities.

### 🤖 **AI-Powered Intelligence**
*   **Auto-Categorization**: Automatically assigns categories and tags to imported videos.
*   **Content Regeneration**: Admin tools to re-process and improve metadata for existing libraries.
*   **Smart Tagging**: Generates up to 10 descriptive tags per video for better discoverability.
*   **Multi-Language Support**: Automatic translation of metadata (English & Serbian).

### 🛠️ **Powerful Admin Dashboard**
*   **Content Management**: Bulk edit, delete, and organize videos.
*   **AI Tools**: Trigger AI regeneration for tags and categories directly from the UI.
*   **SEO Management**: Dynamic meta tags, sitemap generation, and robots.txt configuration.
*   **System Health**: Real-time monitoring of error logs, cache stats, and server performance.

### 🔌 **Advanced Tech Stack**
*   **Backend**: Node.js, Express, Drizzle ORM (PostgreSQL).
*   **Frontend**: React, Vite, Tailwind CSS, Shadcn UI, TanStack Query.
*   **Infrastructure**: Redis caching, Docker support, Vercel deployment ready.

---

## 🏗️ Architecture

<div align="center">

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React + Vite | Blazing fast SPA with HMR. |
| **UI Framework** | Tailwind + Shadcn | Beautiful, accessible components. |
| **State Mgmt** | TanStack Query | Efficient server state management & caching. |
| **Backend** | Express.js | Robust RESTful API architecture. |
| **Database** | PostgreSQL | Relational data integrity with Drizzle ORM. |
| **Caching** | Redis | High-performance session & data caching. |
| **AI Engine** | OpenAI / Ollama | Intelligent content analysis & generation. |

</div>

---

## ⚡ Getting Started

Follow these steps to get your local development environment up and running.

### Prerequisites
*   **Node.js** (v18+)
*   **PostgreSQL** database
*   **Redis** (optional, for caching)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/magnetoid/nisam-video.git
    cd nisam-video
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment**
    Create a `.env` file in the root directory:
    ```env
    DATABASE_URL="postgres://user:pass@host:port/db"
    SESSION_SECRET="super-secret-key"
    ADMIN_USERNAME="admin"
    ADMIN_PASSWORD="password"
    # Optional:
    REDIS_URL="redis://localhost:6379"
    OPENAI_API_KEY="sk-..."
    ```

Notes:
- `REDIS_URL` supports both `redis://` and `rediss://` (TLS). For `rediss://` the client enables TLS automatically.

### Coolify / Docker Deploy Notes

If you see Postgres errors like `Tenant or user not found` in logs, your `DATABASE_URL` is pointing to a Postgres host where the user/tenant (or endpoint) does not exist.

- Verify `DATABASE_URL` in Coolify matches the database provider exactly (host, database name, username, password).
- If using a managed Postgres (Neon/Supabase/etc.), ensure the endpoint/role still exists and that SSL requirements match your provider.
- If you run an internal Postgres without SSL, set `DB_SSL=0` (the app defaults to SSL enabled).
- You can disable the background KV cleanup job (to stop log spam while debugging DB credentials) by setting `KV_DISABLE_BACKGROUND_TASKS=1`.

4.  **Initialize Database**
    ```bash
    npm run db:push
    ```

5.  **Start Development Server**
    ```bash
    npm run dev
    ```

---

## 🛡️ Admin & Security

*   **Secure Access**: Protected admin routes with session-based authentication.
*   **Rate Limiting**: Built-in protection against abuse for public endpoints.
*   **Input Validation**: Strict Zod schema validation for all API requests.
*   **Error Logging**: Comprehensive error tracking with searchable logs in the admin panel.

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<div align="center">

**Built with ❤️ by [Magnetoid](https://github.com/magnetoid)**

</div>
