---
title: MemoryVerse Backend
emoji: 🧠
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# MemoryVerse AI - Your Personal Digital Second Brain

<div align="center">

![MemoryVerse AI](https://img.shields.io/badge/MemoryVerse--AI-Personal%20Second%20Brain-purple?style=for-the-badge&logo=brain&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11+-blue?style=for-the-badge&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-green?style=for-the-badge&logo=fastapi)
![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react)
![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector%20Store-orange?style=for-the-badge)

### 🧠 Semantic AI Search • 🕸️ Connected Knowledge Graph • 💬 Citations-Backed Chat Assistant

</div>

---

## 🚀 Overview

**MemoryVerse AI** is an AI-powered personal memory assistant designed to help you remember, organize, and connect your entire digital journey. Acting as a digital "second brain," the platform allows users to upload documents, images, and notes, automatically extracting key metadata, entities, and emotions. By mapping the semantic connections between memories, MemoryVerse AI enables natural language exploration of your digital life.

### Why MemoryVerse AI?

- **🧠 Concept-Based Semantic Search**: Find files not just by filename, but by meaning and context using SentenceTransformers and ChromaDB vector search.
- **💬 Citations-Backed Chat Assistant**: Interact with your digital second brain using a streaming RAG system that highlights references and links directly to target document sections.
- **🕸️ Connected Knowledge Graph**: Visualize relationships, keywords, and entities connecting your documents, notes, and timelines.
- **🎨 Premium UI/UX**: Built with dark mode aesthetics, glassmorphism card layouts, and responsive transitions.
- **🔒 Private-First & Fast**: Runs vector indexes and databases locally using SQLite and ChromaDB, powered by Groq's high-speed AI inference models.

---

## ✨ Features

### 🛠️ Core Capabilities

| Feature | Description | Capabilities |
|---------|-------------|--------------|
| **Second Brain Explorer** | Multi-mode search console | Semantic AI vector search (SentenceTransformers), exact keyword metadata matching, and dynamic chip suggestions. |
| **Chat Assistant** | Natural language conversational bot | Streaming RAG (Retrieval-Augmented Generation) responses from Groq, confidence scoring, and citation cards that copy or jump straight to highlighted sources. |
| **Relationships (Graph)** | Concept mapping & entity relationships | Visualizing documents, entities, categories, and tags as interactive nodes in an organic network layout. |
| **Upload Center** | Multi-format asset ingestion | Automatic parsing for PDFs, plain text, and images with OCR, metadata extraction (people, locations, organizations), and emotion classification. |
| **Timeline View** | Chronological memory logging | Interactive vertical timeline listing digital assets chronologically with smart filtering. |
| **Memories Dashboard** | Central asset workspace | View, search, filter, preview, edit, or delete items and download raw files. |

---

## 🏗️ Architecture

MemoryVerse AI uses a modern, modular design separating local database layers from AI services and a single-page React frontend:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            ⚛️ REACT FRONTEND                                 │
│                                                                              │
│  • Search Console      • Chat Assistant (SSE)    • Relationships (Graph)     │
│  • Memory Timeline     • Upload Center           • Memory Detail Highlight   │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │
                                    ▼  (HTTP REST & SSE Streams)
┌──────────────────────────────────────────────────────────────────────────────┐
│                           ⚡ FASTAPI BACKEND                                 │
│                                                                              │
│  • FastAPI Routers     • Database Session (SQLAlchemy)                       │
│  • Vector DB Queries   • LLM Streaming & Orchestration                       │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
         ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
         │ SQL DATABASE │  │  VECTOR DB   │  │   AI LAYER   │
         │   (SQLite)   │  │  (ChromaDB)  │  │    (Groq)    │
         └──────────────┘  └──────────────┘  └──────────────┘
                │                  │                  │
                │• Documents Metadata│                │• Metadata Extractor
                │• Document Chunks   │• Dense Vectors │• Llama 3 / Mixtral
                │• Embedding Status  │  (384-dims)    │• Streaming RAG
                └──────────────────┴────────────────┴─────────────────┘
```

### Technology Stack

**Frontend:**
- React 18 (Vite, JavaScript)
- TailwindCSS with custom design system
- Framer Motion for premium card and panel transitions
- Zustand for lightweight, persistent client store (e.g., chat history)
- TanStack React Query for cached server data management
- Lucide React for consistent modern iconography

**Backend & AI Services:**
- FastAPI (Python 3.11+) with Uvicorn server
- SQLAlchemy ORM with SQLite database
- ChromaDB for local vector embeddings indexing and querying
- SentenceTransformers (`all-MiniLM-L6-v2`) generating 384-dimensional dense vectors
- Groq AI SDK for metadata generation and Chat Assistant streaming
- Cloudinary Storage SDK for raw digital file uploads and storage

---

## 📂 Directory Structure

```text
MemoryVerse_AI/
│
├── frontend/
│   ├── src/
│   │   ├── components/      # Common UI, Layout, Graph, and Timeline panels
│   │   ├── pages/           # High-level routes (Dashboard, Chat, Search, Memories, Settings)
│   │   ├── store/           # Zustand persistent state stores (chatStore.js)
│   │   ├── App.jsx          # React app entry point and routes config
│   │   └── index.css        # Tailwind layout and customized component styles
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── app/
│   │   ├── api/             # API Router endpoints (search, chat, graph, uploads)
│   │   ├── services/        # Service logic (embedding, vector_store, groq, cloudinary)
│   │   ├── models/          # SQLite schema mappings (Document, Chunk, Metadata)
│   │   ├── database/        # DB connection configurations
│   │   └── main.py          # FastAPI application entry point
│   ├── requirements.txt
│   └── memoryverse.db       # Local SQLite database
│
└── README.md
```

---

## 🛠️ Quick Start

### Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **Groq API Key** ([Get one here](https://console.groq.com))
- **Cloudinary Account** (for file attachments storage)

### Backend Setup

1. **Navigate** to the backend directory:
   ```bash
   cd backend
   ```
2. **Create virtual environment** and activate it:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On Linux/Mac:
   source venv/bin/activate
   ```
3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
4. **Configure environment**:
   Create a `.env` file in the `backend/` directory:
   ```env
   PORT=8000
   DATABASE_URL=sqlite:///./memoryverse.db
   CHROMA_DB_PATH=./chroma_db
   GROQ_API_KEY=your_groq_api_key
   CLOUDINARY_URL=cloudinary://your_key:your_secret@your_cloud_name
   ```
5. **Run the backend**:
   ```bash
   uvicorn app.main:app --reload
   ```

### Frontend Setup

1. **Navigate** to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. **Install node dependencies**:
   ```bash
   npm install
   ```
3. **Configure environment**:
   Create a `.env` file in the `frontend/` directory:
   ```env
   VITE_API_URL=http://localhost:8000
   ```
4. **Run the development server**:
   ```bash
   npm run dev
   ```

---

## 📖 Usage

### Web Interface

1. **Browse** to http://localhost:3000
2. **Upload Files**: Head to the upload page and attach a PDF or text file. The backend will parse, index, and analyze it.
3. **Search Console**: Query your memories conceptually using **Semantic AI Search** (e.g. *"What documents mention Probability?"*) or switch to **Keyword Metadata Match**.
4. **Chat Assistant**: Type natural language prompts to chat with your files. Click references to open the source document with matched text highlighted.
5. **Relationships**: Explore the interactive knowledge graph mapping associations across your digital memories.

---

## 🤝 Contributing

Contributions make the open-source community an amazing place to learn and build.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

<div align="center">
  <strong>MemoryVerse AI © 2026 • AI-Powered Second Brain</strong>
</div>
