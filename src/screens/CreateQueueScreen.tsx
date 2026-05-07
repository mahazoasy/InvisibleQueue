import React, { useState, useEffect } from 'react';
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
import MapView, { Marker, MapPressEvent, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';

type CreateQueueNavigationProp = StackNavigationProp<RootStackParamList, 'CreateQueue'>;
type Props = { navigation: CreateQueueNavigationProp };

export default function CreateQueueScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setLocation(coords);
        setRegion({ ...coords, latitudeDelta: 0.008, longitudeDelta: 0.008 });
      } else {
        Alert.alert('Permission refusée', 'La géolocalisation est requise pour créer une file.');
        navigation.goBack();
      }
      setLocating(false);
    })();
  }, []);

  const handleCreateQueue = async () => {
    if (!name.trim()) {
      Alert.alert('Nom requis', 'Veuillez entrer un nom pour la file d\'attente.');
      return;
    }
    if (!location) {
      Alert.alert('Position indisponible', 'Impossible de récupérer votre position.');
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

  const onMapPress = (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setLocation({ latitude, longitude });
    setRegion((prev) => prev ? { ...prev, latitude, longitude } : null);
  };

  const recenterToMyLocation = async () => {
    const loc = await Location.getCurrentPositionAsync({});
    const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    setLocation(coords);
    setRegion((prev) => prev ? { ...prev, ...coords } : null);
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

          {/* Name Input */}
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

          {/* Map Section */}
          <View style={styles.mapSection}>
            <View style={styles.mapHeader}>
              <View>
                <Text style={styles.inputLabel}>Localisation de la file</Text>
                <Text style={styles.mapHint}>Appuyez sur la carte pour ajuster la position</Text>
              </View>
              <TouchableOpacity style={styles.recenterBtn} onPress={recenterToMyLocation}>
                <Ionicons name="navigate" size={16} color="#1A73E8" />
              </TouchableOpacity>
            </View>

            <View style={styles.mapContainer}>
              {region && (
                <MapView
                  style={styles.map}
                  region={region}
                  onPress={onMapPress}
                  showsUserLocation
                  showsMyLocationButton={false}
                  showsCompass={false}
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

              {/* Map overlay info */}
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

          {/* Create Button */}
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
});