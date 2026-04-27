import { GoogleMap, useLoadScript, Marker, InfoWindow } from "@react-google-maps/api";
import { useState, useCallback, useRef, useEffect } from "react";
import axios from "axios";

const containerStyle = {
  width: "100vw",
  height: "100vh"
};

// Default Google Maps style (Standard Roadmap)
const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
};

const createSvgMarker = (text, type) => {
  let bgColor = "#3b82f6"; 
  let size = 40;
  let fontSize = 12;
  
  if (type === "state") {
    bgColor = "rgba(139, 92, 246, 0.9)"; // Purple
    size = 64;
    fontSize = 13;
  } else if (type === "cluster") {
    bgColor = "rgba(16, 185, 129, 0.9)"; // Green
    size = 48;
    fontSize = 14;
  } else if (type === "store") {
    bgColor = "rgba(239, 68, 68, 0.95)"; // Red
    size = 32;
    fontSize = 12;
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="${bgColor}" stroke="#ffffff" stroke-width="2" />
      <text x="${size/2}" y="${size/2}" font-family="Inter, sans-serif" font-size="${fontSize}" font-weight="bold" fill="white" text-anchor="middle" dy=".3em">${text}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export default function MapView() {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  });

  const [data, setData] = useState([]);
  const [mapRef, setMapRef] = useState(null);
  const [selectedStore, setSelectedStore] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const cacheRef = useRef({});
  const timeoutRef = useRef(null);

  const onLoad = useCallback((map) => {
    setMapRef(map);
  }, []);

  const fetchData = useCallback(() => {
    if (!mapRef) return;

    const bounds = mapRef.getBounds();
    if (!bounds) return;

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const zoom = mapRef.getZoom();

    // Cache key logic - adjust precision based on zoom
    // Higher zoom needs higher precision for cache keys to avoid stale results while panning
    const precision = zoom > 14 ? 4 : (zoom > 10 ? 2 : 1);
    const roundTo = (num, decimals) => Number(Math.round(num + "e" + decimals) + "e-" + decimals);
    const cacheKey = `${roundTo(ne.lat(), precision)}_${roundTo(ne.lng(), precision)}_${roundTo(sw.lat(), precision)}_${roundTo(sw.lng(), precision)}_${Math.floor(zoom)}`;

    if (cacheRef.current[cacheKey]) {
      setData(cacheRef.current[cacheKey]);
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setLoading(true);
    timeoutRef.current = setTimeout(() => {
      axios.get("http://localhost:5000/stores", {
        params: {
          neLat: ne.lat(),
          neLng: ne.lng(),
          swLat: sw.lat(),
          swLng: sw.lng(),
          zoom
        }
      })
      .then(res => {
        setData(res.data);
        cacheRef.current[cacheKey] = res.data;
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
    }, 250); 

  }, [mapRef]);

  if (!isLoaded) return <div className="loading-screen">Loading Map...</div>;

  return (
    <div className="map-wrapper">
      <div className="map-overlay-title">
        <h1>US Retail Explorer</h1>
        <p>Interactive Map of 150k+ Locations</p>
        {loading && <span className="loading-indicator">Updating...</span>}
      </div>
      
      <GoogleMap
        mapContainerStyle={containerStyle}
        zoom={4}
        center={{ lat: 39.8283, lng: -98.5795 }}
        options={mapOptions}
        onLoad={onLoad}
        onIdle={fetchData}
        onClick={() => setSelectedStore(null)}
      >
        {data.map((item, i) => {
          const [lng, lat] = item.geometry.coordinates;
          const { cluster, point_count, isState, label, brand, storeId, address, type } = item.properties;

          let iconUrl = "";
          let zIndex = 1;

          if (isState) {
            iconUrl = createSvgMarker(label, "state");
            zIndex = 10;
          } else if (cluster) {
            const countStr = point_count > 1000 ? (point_count / 1000).toFixed(1) + 'k' : point_count;
            iconUrl = createSvgMarker(countStr, "cluster");
            zIndex = 20;
          } else {
            // Tier 3: Individual Store Marker
            iconUrl = createSvgMarker(brand ? brand.substring(0, 2).toUpperCase() : "S", "store");
            zIndex = 30;
          }

          return (
            <Marker
              key={storeId || `cluster-${i}-${lat}-${lng}`}
              position={{ lat, lng }}
              icon={{
                url: iconUrl,
                scaledSize: isState ? new window.google.maps.Size(64, 64) : 
                            cluster ? new window.google.maps.Size(48, 48) : 
                            new window.google.maps.Size(32, 32),
                anchor: isState ? new window.google.maps.Point(32, 32) :
                        cluster ? new window.google.maps.Point(24, 24) :
                        new window.google.maps.Point(16, 16),
              }}
              zIndex={zIndex}
              onClick={() => {
                if (cluster || isState) {
                  mapRef.setCenter({ lat, lng });
                  mapRef.setZoom(mapRef.getZoom() + (isState ? 3 : 2));
                } else {
                  setSelectedStore(item);
                }
              }}
            />
          );
        })}

        {selectedStore && (
          <InfoWindow
            position={{ 
              lat: selectedStore.geometry.coordinates[1], 
              lng: selectedStore.geometry.coordinates[0] 
            }}
            onCloseClick={() => setSelectedStore(null)}
            options={{ pixelOffset: new window.google.maps.Size(0, -15) }}
          >
            <div className="info-window-content">
              <h3>{selectedStore.properties.brand || "Retail Store"}</h3>
              <div className="info-grid">
                <p><strong>Address:</strong> {selectedStore.properties.address || "N/A"}</p>
                <p><strong>Status:</strong> <span className={`status-badge ${(selectedStore.properties.status || "").toLowerCase()}`}>
                  {selectedStore.properties.status || "Unknown"}
                </span></p>
                <p><strong>Type:</strong> {selectedStore.properties.type || "Retail"}</p>
                <p><strong>Location:</strong> {selectedStore.properties.city}, {selectedStore.properties.state}</p>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}