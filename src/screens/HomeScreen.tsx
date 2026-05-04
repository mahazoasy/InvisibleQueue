import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { supabase, Queue } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getGuestSession, setActiveEntry } from '../utils/storage';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

type Props = {
  navigation: HomeScreenNavigationProp;
};

const RADIUS_KM = 5;

type QueueWithCount = Queue & { waitingCount: number };

export default function HomeScreen({ navigation }: Props) {
  const [queues, setQueues] = useState<QueueWithCount[]>([]);
  const [location, setLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [loading, setLoading] = useState(true);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState<Queue | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const { user, guestSessionId, isAuthenticated } = useAuth();

  useEffect(() => {
    requestLocationPermission();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (location) {
        fetchNearbyQueues();
      }
    }, [location])
  );

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'La géolocalisation est nécessaire pour voir les files à proximité');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    setLocation(loc.coords);
  };

  const fetchNearbyQueues = async () => {
    if (!location) return;
    setLoading(true);
    const { data, error } = await supabase.from('queues').select('*');
    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const filtered = data.filter(queue => {
      const distance = getDistanceFromLatLonInKm(
        location.latitude, location.longitude,
        queue.latitude, queue.longitude
      );
      return distance <= RADIUS_KM;
    });

    // Ajouter le nombre de personnes en attente
    const queuesWithCount = await Promise.all(filtered.map(async (queue) => {
      const { count } = await supabase
        .from('queue_entries')
        .select('*', { count: 'exact', head: true })
        .eq('queue_id', queue.id)
        .eq('status', 'waiting');
      return { ...queue, waitingCount: count || 0 };
    }));

    setQueues(queuesWithCount);
    setLoading(false);
  };

  const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const deg2rad = (deg: number) => deg * (Math.PI / 180);

  const handleJoinQueue = async () => {
    if (!location || !selectedQueue) return;

    const distance = getDistanceFromLatLonInKm(
      location.latitude, location.longitude,
      selectedQueue.latitude, selectedQueue.longitude
    );
    if (distance > RADIUS_KM) {
      Alert.alert('Trop loin', `Vous devez être à moins de ${RADIUS_KM} km pour rejoindre cette file`);
      return;
    }

    const displayName = isAuthenticated ? user?.user_metadata?.full_name || user?.email : guestName;
    const email = isAuthenticated ? user?.email : guestEmail;

    if (!displayName || !email) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    // Obtenir le prochain ordre
    const { data: lastEntry } = await supabase
      .from('queue_entries')
      .select('queue_order')
      .eq('queue_id', selectedQueue.id)
      .eq('status', 'waiting')
      .order('queue_order', { ascending: false })
      .limit(1);

    const nextOrder = (lastEntry && lastEntry[0]?.queue_order) ? lastEntry[0].queue_order + 1 : 1;

    const entryData = {
      queue_id: selectedQueue.id,
      user_id: user?.id || null,
      session_id: !isAuthenticated ? guestSessionId : null,
      display_name: displayName,
      email: email,
      status: 'waiting' as const,
      missed_count: 0,
      queue_order: nextOrder,
    };

    const { data: newEntry, error } = await supabase.from('queue_entries').insert(entryData).select().single();
    if (error) {
      Alert.alert('Erreur', error.message);
      return;
    }

    await setActiveEntry(newEntry.id, selectedQueue.id);
    setJoinModalVisible(false);
    setGuestName('');
    setGuestEmail('');
    navigation.navigate('ActiveQueue', { entryId: newEntry.id, queueId: selectedQueue.id });
  };

  const renderQueueCard = ({ item }: { item: QueueWithCount }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        setSelectedQueue(item);
        if (isAuthenticated) {
          handleJoinQueue();
        } else {
          setJoinModalVisible(true);
        }
      }}
    >
      <Text style={styles.queueName}>{item.name}</Text>
      <Text style={styles.queueInfo}>🚶 En attente: {item.waitingCount} personnes</Text>
      {location && (
        <Text style={styles.queueInfo}>
          ⏱️ Distance: {getDistanceFromLatLonInKm(location.latitude, location.longitude, item.latitude, item.longitude).toFixed(1)} km
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {!location && <Text style={styles.loading}>Activation de la géolocalisation...</Text>}
      <FlatList
        data={queues}
        keyExtractor={(item) => item.id}
        renderItem={renderQueueCard}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={fetchNearbyQueues}
        ListEmptyComponent={<Text style={styles.empty}>Aucune file à proximité</Text>}
      />
      {isAuthenticated && (
        <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreateQueue')}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      <Modal visible={joinModalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rejoindre {selectedQueue?.name}</Text>
            <TextInput
              style={styles.input}
              placeholder="Votre nom"
              value={guestName}
              onChangeText={setGuestName}
            />
            <TextInput
              style={styles.input}
              placeholder="Votre email"
              value={guestEmail}
              onChangeText={setGuestEmail}
              keyboardType="email-address"
            />
            <TouchableOpacity style={styles.modalButton} onPress={handleJoinQueue}>
              <Text style={styles.modalButtonText}>Rejoindre</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setJoinModalVisible(false)}>
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loading: { textAlign: 'center', marginTop: 20, color: '#7f8c8d' },
  list: { padding: 16 },
  card: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  queueName: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  queueInfo: { fontSize: 14, color: '#666', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 50, color: '#999' },
  fab: { position: 'absolute', bottom: 20, right: 20, backgroundColor: '#3498db', width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  fabText: { fontSize: 28, color: 'white', fontWeight: 'bold' },
  modalContainer: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: 'white', margin: 20, padding: 20, borderRadius: 12 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 15, fontSize: 16 },
  modalButton: { backgroundColor: '#3498db', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  modalButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  cancelText: { textAlign: 'center', marginTop: 15, color: '#e74c3c' },
});