import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';

type CreateQueueNavigationProp = StackNavigationProp<RootStackParamList, 'CreateQueue'>;
type Props = { navigation: CreateQueueNavigationProp };

const DISTANCE_LIMIT_METERS = 100; // L'utilisateur doit être à moins de 100m de l'emplacement choisi

// Fonction de calcul de distance (formule de Haversine) – retourne la distance en mètres
const haversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Rayon terrestre en mètres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export default function CreateQueueScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(true);
  const [userPosition, setUserPosition] = useState<Location.LocationObjectCoords | null>(null);
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);

  // Demande de permission et suivi en temps réel
  useEffect(() => {
    let watchSubscription: Location.LocationSubscription;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'La géolocalisation est requise pour créer une file.');
        navigation.goBack();
        return;
      }

      // Position initiale
      const initialPos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserPosition(initialPos.coords);
      const coords = {
        latitude: initialPos.coords.latitude,
        longitude: initialPos.coords.longitude,
      };
      setLocation(coords);
      setRegion({
        ...coords,
        latitudeDelta: 0.002,
        longitudeDelta: 0.002,
      });
      setLocating(false);

      // Surveillance en temps réel
      watchSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 2,
        },
        (newLocation) => {
          setUserPosition(newLocation.coords);
        }
      );
    })();

    return () => {
      watchSubscription?.remove();
    };
  }, []);

  // Vérifier la distance avec la fonction haversine
  const checkDistance = (selectedLat: number, selectedLng: number) => {
    if (!userPosition) return false;
    const distance = haversineDistance(
      userPosition.latitude,
      userPosition.longitude,
      selectedLat,
      selectedLng
    );
    return distance <= DISTANCE_LIMIT_METERS;
  };

  const handleCreateQueue = async () => {
    if (!name.trim()) {
      Alert.alert('Nom requis', 'Veuillez entrer un nom pour la file.');
      return;
    }
    if (!location) {
      Alert.alert('Position indisponible', 'Impossible de récupérer votre position.');
      return;
    }
    if (!checkDistance(location.latitude, location.longitude)) {
      Alert.alert(
        'Trop loin',
        `Vous devez être à moins de ${DISTANCE_LIMIT_METERS} mètres de l’emplacement choisi.`
      );
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('queues').insert({
      name: name.trim(),
      latitude: location.latitude,
      longitude: location.longitude,
      created_by: user!.id,
    });
    setLoading(false);
    if (error) {
      Alert.alert('Erreur', error.message);
    } else {
      Alert.alert('File créée !', `"${name.trim()}" est maintenant disponible.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  };

  const onMapPress = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setLocation({ latitude, longitude });
  };

  const recenterToMyLocation = async () => {
    if (userPosition) {
      const coords = {
        latitude: userPosition.latitude,
        longitude: userPosition.longitude,
      };
      setLocation(coords);
      mapRef.current?.animateCamera({ center: coords, zoom: 18 });
      setRegion((prev) => (prev ? { ...prev, ...coords } : null));
    } else {
      Alert.alert('Position inconnue', 'Votre position n’est pas encore disponible.');
    }
  };

  if (locating) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.locatingContainer}>
          <ActivityIndicator size="large" color="#1A73E8" />
          <Text style={styles.locatingText}>Récupération de votre position...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F9FC" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Nom de la file</Text>
            <View style={styles.inputGroup}>
              <Ionicons name="list-outline" size={18} color="#8A94A6" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Ex: Caisse principale, Accueil..."
                placeholderTextColor="#8A94A6"
                value={name}
                onChangeText={setName}
                autoCapitalize="sentences"
                returnKeyType="done"
                maxLength={60}
              />
            </View>
          </View>

          <View style={styles.mapSection}>
            <View style={styles.mapHeader}>
              <View>
                <Text style={styles.inputLabel}>Localisation de la file</Text>
                <Text style={styles.mapHint}>
                  Appuyez sur la carte pour ajuster le point • Position réelle suivie en direct
                </Text>
              </View>
              <TouchableOpacity style={styles.recenterBtn} onPress={recenterToMyLocation}>
                <Ionicons name="navigate" size={16} color="#1A73E8" />
              </TouchableOpacity>
            </View>

            <View style={styles.mapContainer}>
              {region && (
                <MapView
                  ref={mapRef}
                  provider={PROVIDER_GOOGLE}
                  style={styles.map}
                  region={region}
                  onPress={onMapPress}
                  showsUserLocation
                  showsMyLocationButton={false}
                  mapType="hybrid"
                  showsBuildings
                  showsTraffic
                  showsCompass
                  zoomEnabled
                  scrollEnabled
                  rotateEnabled
                  pitchEnabled
                  minZoomLevel={5}
                  maxZoomLevel={20}
                >
                  {location && (
                    <Marker
                      coordinate={location}
                      draggable
                      onDragEnd={(e) => setLocation(e.nativeEvent.coordinate)}
                    >
                      <View style={styles.markerContainer}>
                        <View style={styles.markerBubble}>
                          <Ionicons name="list" size={16} color="#FFFFFF" />
                        </View>
                        <View style={styles.markerTail} />
                      </View>
                    </Marker>
                  )}
                </MapView>
              )}

              {location && (
                <View style={styles.coordsOverlay}>
                  <Ionicons name="location-outline" size={12} color="#8A94A6" />
                  <Text style={styles.coordsText}>
                    {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.createBtn, loading && styles.createBtnDisabled]}
            onPress={handleCreateQueue}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={22} color="#FFFFFF" style={{ marginRight: 10 }} />
                <Text style={styles.createBtnText}>Créer la file d'attente</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.distanceNote}>
            Vous devez être à moins de {DISTANCE_LIMIT_METERS} mètres du point choisi.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F9FC' },
  flex: { flex: 1 },
  locatingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  locatingText: { fontSize: 15, color: '#8A94A6', fontWeight: '500' },
  container: { flex: 1, padding: 20 },
  inputSection: { marginBottom: 20 },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A5568',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: '#E0E5F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: '#0F1C3F',
    fontWeight: '500',
  },
  mapSection: { flex: 1, marginBottom: 20 },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  mapHint: { fontSize: 12, color: '#8A94A6', marginTop: 2 },
  recenterBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  mapContainer: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E0E5F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    position: 'relative',
  },
  map: { flex: 1 },
  markerContainer: { alignItems: 'center' },
  markerBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A73E8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  markerTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#1A73E8',
    marginTop: -1,
  },
  coordsOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  coordsText: { fontSize: 11, color: '#4A5568', fontWeight: '600' },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A73E8',
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  createBtnDisabled: { opacity: 0.7 },
  createBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  distanceNote: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 12,
    color: '#8A94A6',
  },
});