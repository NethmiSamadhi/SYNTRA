// components/PlacesMapView.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { PlaceResult } from '@/lib/services/placesService';

interface PlacesMapViewProps {
  places: PlaceResult[];
  centerLat: number;
  centerLng: number;
}

export function PlacesMapView({ places, centerLat, centerLng }: PlacesMapViewProps) {
  const markersJs = places
    .map((p) => {
      const safeName = p.name.replace(/'/g, "\\'");
      const safeAddr = p.address.replace(/'/g, "\\'");
      return `L.marker([${p.lat}, ${p.lng}]).addTo(map).bindPopup('<b>${safeName}</b><br>${safeAddr}');`;
    })
    .join('\n');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>
        html, body, #map { height: 100%; margin: 0; padding: 0; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        const map = L.map('map').setView([${centerLat}, ${centerLng}], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        L.marker([${centerLat}, ${centerLng}]).addTo(map).bindPopup('You are here').openPopup();
        ${markersJs}
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 400,
    borderRadius: 16,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
  },
});