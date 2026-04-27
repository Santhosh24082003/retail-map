# Interactive US Retail Locations Map

## Overview
A performant, interactive map visualizing 150k+ US retail store locations. Built with React, Google Maps, and Node.js. 

## Demo Walkthrough
*Note: A 2-4 minute screen recording link should be pasted here during final submission.*

## Project Structure
- `backend/` - Node.js + Express backend powering geospatial queries.
- `frontend/` - React + Vite application containing the rich map interface.

## 🚀 Setup & Run Instructions

### 1. Prerequisites
- Node.js (v18+)
- A Google Maps API key

### 2. Environment Variables
In the `frontend` folder, create a `.env` file (or update the existing one):
\`\`\`env
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
\`\`\`

### 3. Backend Setup
1. Navigate to the \`backend\` directory:
   \`cd backend\`
2. Install dependencies:
   \`npm install\`
3. Start the server:
   \`npm start\` (The server will load the CSV and generate spatial indexes before starting on port 5000)

### 4. Frontend Setup
1. Open a new terminal and navigate to the \`frontend\` directory:
   \`cd frontend\`
2. Install dependencies:
   \`npm install\`
3. Start the Vite dev server:
   \`npm run dev\`
4. Open the localhost URL provided by Vite in your browser.

## 🛠️ Tech Choices & Architecture

- **Backend (Node.js & Express)**: Lightweight and fast. Instead of a heavy PostGIS database (given the time limit and dataset size), we load the 150k rows directly into memory on startup. It consumes < 50MB of RAM and enables sub-millisecond querying.
- **Clustering (Supercluster)**: We rely on the `supercluster` library on the backend to dynamically cluster markers. Instead of shipping 150k rows to the client, the backend only returns pre-computed clusters or points visible inside the requested bounds, ensuring the browser renders fluidly.
- **Frontend (React + Vite)**: Using `@react-google-maps/api`. We dynamically generate SVG markers via `data:image/svg+xml` inline directly in React. This skips DOM overhead from custom `OverlayView` elements and provides a sleek, highly customizable design for State Tier, Cluster Tier, and Store Tier.
- **Caching**: The client caches viewports by rounding lat/lng coordinates to ~0.1 degrees. This ensures slight pans don't trigger unnecessary HTTP requests, but larger movements naturally fetch new geospatial bounds.

## ⚖️ Trade-offs & Improvements With More Time
- **Database**: With more time, a PostgreSQL + PostGIS implementation would be established to handle datasets scaling to millions of points, mitigating memory consumption scaling limits.
- **Filters**: While the backend API has `state`, `brand`, and `status` capabilities implemented for filtering, creating a beautiful Sidebar filter UI in the frontend was excluded to focus purely on map rendering latency and styling.
- **Logo Images**: We generate premium CSS-styled circle initials for the brands dynamically rather than relying on an external static asset map. With more time, connecting an AWS S3 bucket mapping brand initials to PNGs would replace the inline SVGs.
