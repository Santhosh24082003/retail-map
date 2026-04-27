const express = require("express");
const Database = require("better-sqlite3");
const cors = require("cors");
const Supercluster = require("supercluster").default || require("supercluster");

const app = express();
app.use(cors());

// Connect to SQLite
const db = new Database("retail.db");
console.log("✅ Connected to SQLite database");

let index = null;
let allPoints = [];

// Capitalize state names
function formatStateName(state) {
  if (!state) return "";
  return state.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// 1. Load data from DB to build the spatial index for clustering
function loadIndex() {
  console.log("Building spatial index from DB...");
  try {
    const rows = db.prepare("SELECT * FROM stores").all();
    
    allPoints = rows.map(s => ({
      type: "Feature",
      properties: {
        cluster: false,
        storeId: s.id,
        brand: s.brand_name,
        city: s.city,
        state: formatStateName(s.state),
        status: s.status,
        // Fallbacks for missing CSV fields
        address: s.city ? `${s.city}, ${formatStateName(s.state)}` : "Address not available",
        type: "Retail Store" 
      },
      geometry: {
        type: "Point",
        coordinates: [s.longitude, s.latitude]
      }
    }));

    index = new Supercluster({
      radius: 60,
      maxZoom: 18, // Increased maxZoom for better street-level detail
      extent: 256
    });
    index.load(allPoints);
    console.log(`✅ Spatial Index built with ${allPoints.length} points`);
  } catch (error) {
    console.error("❌ Failed to build spatial index:", error.message);
  }
}

loadIndex();

app.get("/stores", (req, res) => {
  try {
    const { neLat, neLng, swLat, swLng, zoom, state, brand, status } = req.query;

    const neLatNum = parseFloat(neLat);
    const neLngNum = parseFloat(neLng);
    const swLatNum = parseFloat(swLat);
    const swLngNum = parseFloat(swLng);
    const zoomNum = Math.floor(parseFloat(zoom)) || 4;

    if (!index) return res.status(503).json({ error: "Initializing index..." });

    // --- TIER 1: State View (Zoom <= 4) ---
    if (zoomNum <= 4) {
      const stateQuery = db.prepare(`
        SELECT state, COUNT(*) as count, AVG(latitude) as lat, AVG(longitude) as lng 
        FROM stores 
        WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
        GROUP BY state
      `);
      
      const states = stateQuery.all(swLatNum, neLatNum, swLngNum, neLngNum);
      
      const features = states.map(s => {
        const formattedCount = s.count > 1000 ? (s.count / 1000).toFixed(1) + 'k' : s.count;
        return {
          type: "Feature",
          properties: {
            cluster: false,
            isState: true,
            state: formatStateName(s.state),
            count: s.count,
            label: formattedCount
          },
          geometry: {
            type: "Point",
            coordinates: [s.lng, s.lat]
          }
        };
      });
      return res.json(features);
    }

    // --- TIER 2 & 3: Clustered/Detailed View ---
    
    // If filters are applied, we query the DB specifically
    if (brand || status || state) {
      let sql = "SELECT * FROM stores WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?";
      const params = [swLatNum, neLatNum, swLngNum, neLngNum];
      
      if (brand) { sql += " AND brand_name = ?"; params.push(brand); }
      if (status) { sql += " AND status = ?"; params.push(status); }
      if (state) { sql += " AND state = ?"; params.push(state.toLowerCase()); }

      const filteredRows = db.prepare(sql).all(...params);
      const filteredPoints = filteredRows.map(s => ({
        type: "Feature",
        properties: {
          cluster: false,
          storeId: s.id,
          brand: s.brand_name,
          city: s.city,
          state: formatStateName(s.state),
          status: s.status,
          address: `${s.city}, ${formatStateName(s.state)}`,
          type: "Retail Store"
        },
        geometry: {
          type: "Point",
          coordinates: [s.longitude, s.latitude]
        }
      }));

      // Only cluster if there are many points
      if (filteredPoints.length > 500 && zoomNum < 14) {
        const tempIndex = new Supercluster({ radius: 60, maxZoom: 18 });
        tempIndex.load(filteredPoints);
        return res.json(tempIndex.getClusters([swLngNum, swLatNum, neLngNum, neLatNum], zoomNum));
      }
      return res.json(filteredPoints);
    }

    // Default: Use pre-built global index for speed
    // Use the bounds with a small buffer to ensure markers on edges are loaded
    const clusters = index.getClusters(
      [swLngNum - 0.01, swLatNum - 0.01, neLngNum + 0.01, neLatNum + 0.01],
      zoomNum
    );

    res.json(clusters);

  } catch (err) {
    console.error("SERVER ERROR:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(5000, () => console.log("🚀 Server running on port 5000 with SQLite support"));