import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import MapView, { Marker, MapPressEvent, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';

type CreateQueueNavigationProp = StackNavigationProp<RootStackParamList, 'CreateQueue'>;

type Props = {
  navigation: CreateQueueNavigationProp;
};

export default function CreateQueueScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        setRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } else {
        Alert.alert('Permission refusée', 'Impossible de créer une file sans géolocalisation');
      }
    })();
  }, []);

  const handleCreateQueue = async () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un nom pour la file');
      return;
    }
    if (!location) {
      Alert.alert('Erreur', 'Position non disponible');
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
      Alert.alert('Succès', 'File créée avec succès !');
      navigation.goBack();
    }
  };

  const onMapPress = (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setLocation({ latitude, longitude });
    if (region) {
      setRegion({ ...region, latitude, longitude });
    }
  };

  if (!region) {
    return <ActivityIndicator size="large" style={styles.loader} />;
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Nom de la file d'attente"
        value={name}
        onChangeText={setName}
      />
      <Text style={styles.label}>Position de la file (appuyez sur la carte pour modifier)</Text>
      <MapView
        style={styles.map}
        region={region}
        onPress={onMapPress}
      >
        {location && <Marker coordinate={location} draggable onDragEnd={(e) => setLocation(e.nativeEvent.coordinate)} />}
      </MapView>
      <TouchableOpacity style={styles.button} onPress={handleCreateQueue} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Création...' : 'Créer la file'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, fontSize: 16, backgroundColor: 'white', marginBottom: 15 },
  label: { fontSize: 14, color: '#666', marginBottom: 10 },
  map: { height: 400, borderRadius: 12, marginBottom: 20 },
  button: { backgroundColor: '#3498db', padding: 15, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  loader: { flex: 1, justifyContent: 'center' },
});