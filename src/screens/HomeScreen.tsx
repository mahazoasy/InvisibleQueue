import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { supabase, Queue } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { setActiveEntry } from '../utils/storage';
import { StackNavigationProp } from '@react-navigation/stack';
import QueueCard from '../components/QueueCard';
import { RootStackParamList } from '../../App';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;
type Props = { navigation: HomeScreenNavigationProp };

const RADIUS_KM = 5;
type QueueWithCount = Queue & { waitingCount: number };

export default function HomeScreen({ navigation }: Props) {
  const [queues, setQueues] = useState<QueueWithCount[]>([]);
  const [location, setLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState<Queue | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [joining, setJoining] = useState(false);
  const { user, guestSessionId, isAuthenticated } = useAuth();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    requestLocationPermission();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (location) fetchNearbyQueues();
    }, [location])
  );

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Géolocalisation requise',
        'Activez la localisation pour voir les files à proximité.',
        [{ text: 'OK' }]
      );
      setLoading(false);
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    setLocation(loc.coords);
  };

  const fetchNearbyQueues = async (isRefresh = false) => {
    if (!location) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const { data, error } = await supabase.from('queues').select('*');
    if (error) {
      console.error(error);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const filtered = data.filter(q =>
      getDistance(location.latitude, location.longitude, q.latitude, q.longitude) <= RADIUS_KM
    );

    const withCounts = await Promise.all(
      filtered.map(async (q) => {
        const { count } = await supabase
          .from('queue_entries')
          .select('*', { count: 'exact', head: true })
          .eq('queue_id', q.id)
          .eq('status', 'waiting');
        return { ...q, waitingCount: count || 0 };
      })
    );

    setQueues(withCounts);
    setLoading(false);
    setRefreshing(false);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  };

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // ----- FONCTIONS CORRIGÉES -----
  const openJoinModal = async (queue: Queue) => {
    setSelectedQueue(queue);
    if (isAuthenticated) {
      // Vérifier si l'utilisateur a déjà une entrée active dans cette file
      const { data: existing, error } = await supabase
        .from('queue_entries')
        .select('id')
        .eq('queue_id', queue.id)
        .eq('user_id', user?.id)
        .eq('status', 'waiting')
        .maybeSingle();

      if (existing) {
        Alert.alert(
          'Déjà inscrit',
          'Vous êtes déjà dans cette file d\'attente.',
          [
            { text: 'Voir ma position', onPress: () => navigation.navigate('ActiveQueue', { entryId: existing.id, queueId: queue.id }) },
            { text: 'OK' }
          ]
        );
        return;
      }
      joinQueue(queue);
    } else {
      setJoinModalVisible(true);
    }
  };

  const joinQueue = async (queue?: Queue) => {
    const target = queue || selectedQueue;
    if (!location || !target) return;

    // Vérifier la distance
    if (getDistance(location.latitude, location.longitude, target.latitude, target.longitude) > RADIUS_KM) {
      Alert.alert('Trop loin', `Vous devez être à moins de ${RADIUS_KM} km pour rejoindre cette file.`);
      return;
    }

    // Cas invité : vérifier si une entrée existe déjà via session_id
    if (!isAuthenticated) {
      const { data: existing } = await supabase
        .from('queue_entries')
        .select('id')
        .eq('queue_id', target.id)
        .eq('session_id', guestSessionId)
        .eq('status', 'waiting')
        .maybeSingle();

      if (existing) {
        Alert.alert(
          'Déjà inscrit',
          'Vous êtes déjà dans cette file d\'attente.',
          [
            { text: 'Voir ma position', onPress: () => navigation.navigate('ActiveQueue', { entryId: existing.id, queueId: target.id }) },
            { text: 'OK' }
          ]
        );
        setJoinModalVisible(false);
        return;
      }
    }

    const displayName = isAuthenticated
      ? user?.user_metadata?.full_name || user?.email
      : guestName.trim();
    const email = isAuthenticated ? user?.email : guestEmail.trim();

    if (!displayName || !email) {
      Alert.alert('Champs manquants', 'Veuillez remplir tous les champs.');
      return;
    }

    setJoining(true);
    const { data: lastEntry } = await supabase
      .from('queue_entries')
      .select('queue_order')
      .eq('queue_id', target.id)
      .eq('status', 'waiting')
      .order('queue_order', { ascending: false })
      .limit(1);

    const nextOrder = lastEntry?.[0]?.queue_order ? lastEntry[0].queue_order + 1 : 1;

    const { data: newEntry, error } = await supabase
      .from('queue_entries')
      .insert({
        queue_id: target.id,
        user_id: user?.id || null,
        session_id: !isAuthenticated ? guestSessionId : null,
        display_name: displayName,
        email,
        status: 'waiting',
        missed_count: 0,
        queue_order: nextOrder,
      })
      .select()
      .single();

    setJoining(false);
    if (error) {
      Alert.alert('Erreur', error.message);
      return;
    }

    await setActiveEntry(newEntry.id, target.id);
    setJoinModalVisible(false);
    setGuestName('');
    setGuestEmail('');
    navigation.navigate('ActiveQueue', { entryId: newEntry.id, queueId: target.id });
  };

  const renderQueueCard = ({ item, index }: { item: QueueWithCount; index: number }) => (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
      }}
    >
      <QueueCard
        queue={item}
        onPress={() => openJoinModal(item)}
        distance={location ? getDistance(location.latitude, location.longitude, item.latitude, item.longitude) : undefined}
      />
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F9FC" />
      <View style={styles.container}>
        <View style={styles.infoBar}>
          <View style={styles.locationPill}>
            <Ionicons name="location" size={14} color="#1A73E8" />
            <Text style={styles.locationText}>
              {location ? `Rayon ${RADIUS_KM} km` : 'Localisation...'}
            </Text>
          </View>
          <Text style={styles.queueCount}>
            {queues.length} file{queues.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1A73E8" />
            <Text style={styles.loadingText}>Recherche des files à proximité...</Text>
          </View>
        ) : (
          <FlatList
            data={queues}
            keyExtractor={(item) => item.id}
            renderItem={renderQueueCard}
            contentContainerStyle={styles.list}
            refreshing={refreshing}
            onRefresh={() => fetchNearbyQueues(true)}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={56} color="#C5CDE0" />
                <Text style={styles.emptyTitle}>Aucune file trouvée</Text>
                <Text style={styles.emptySubtitle}>
                  Aucune file d'attente dans un rayon de {RADIUS_KM} km.
                </Text>
                {isAuthenticated && (
                  <TouchableOpacity
                    style={styles.createFromEmpty}
                    onPress={() => navigation.navigate('CreateQueue')}
                  >
                    <Text style={styles.createFromEmptyText}>Créer une file</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        )}

        {isAuthenticated && (
          <TouchableOpacity
            style={styles.fab}
            onPress={() => navigation.navigate('CreateQueue')}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={joinModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Rejoindre la file</Text>
            <Text style={styles.modalQueueName}>{selectedQueue?.name}</Text>

            <View style={styles.inputGroup}>
              <Ionicons name="person-outline" size={18} color="#8A94A6" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Votre nom"
                placeholderTextColor="#8A94A6"
                value={guestName}
                onChangeText={setGuestName}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.inputGroup}>
              <Ionicons name="mail-outline" size={18} color="#8A94A6" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Votre email"
                placeholderTextColor="#8A94A6"
                value={guestEmail}
                onChangeText={setGuestEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              style={[styles.joinBtn, joining && { opacity: 0.7 }]}
              onPress={() => joinQueue()}
              disabled={joining}
            >
              {joining ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="enter-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.joinBtnText}>Rejoindre</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setJoinModalVisible(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F9FC' },
  container: { flex: 1, backgroundColor: '#F7F9FC' },
  infoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EBF2',
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF4FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  locationText: { fontSize: 13, color: '#1A73E8', fontWeight: '600' },
  queueCount: { fontSize: 13, color: '#8A94A6', fontWeight: '500' },
  list: { padding: 16, paddingBottom: 90 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { color: '#8A94A6', fontSize: 15, fontWeight: '500' },
  emptyContainer: { flex: 1, alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#2C3E60', marginTop: 20, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#8A94A6', textAlign: 'center', lineHeight: 20 },
  createFromEmpty: {
    marginTop: 24,
    backgroundColor: '#1A73E8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  createFromEmptyText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1A73E8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 28, 63, 0.5)',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E5F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#0F1C3F', marginBottom: 4 },
  modalQueueName: { fontSize: 15, color: '#1A73E8', fontWeight: '600', marginBottom: 24 },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F6FB',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: 50, fontSize: 15, color: '#0F1C3F', fontWeight: '500' },
  joinBtn: {
    backgroundColor: '#1A73E8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 6,
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  joinBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', marginTop: 16, paddingVertical: 8 },
  cancelBtnText: { color: '#E74C3C', fontSize: 15, fontWeight: '600' },
});