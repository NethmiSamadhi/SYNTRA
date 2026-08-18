// lib/hooks/useLocation.ts
import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

export interface UserLocation {
  latitude: number;
  longitude: number;
}

export function useLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchLocation() {
      try {
        const permissionResult = await Location.requestForegroundPermissionsAsync();
        if (permissionResult.status !== 'granted') {
          if (isMounted) {
            setErrorMsg('Location permission denied');
            setLoading(false);
          }
          return;
        }

        const position = await Location.getCurrentPositionAsync({});
        if (isMounted) {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMsg('Failed to get location');
          setLoading(false);
        }
        console.error('Location error:', error);
      }
    }

    fetchLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  return { location: location, errorMsg: errorMsg, loading: loading };
}