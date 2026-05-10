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
  ImageBackground,
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

const DARK_BG   = '#0F1C3F';   
const BRAND     = '#1A73E8';   
const CARD_BG   = '#FFFFFF';
const SURFACE   = '#F4F6FB';
const GRAY      = '#8A94A6';
const LIGHT_BG  = '#F7F9FC';

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
  const headerAnim = React.useRef(new Animated.Value(-30)).current;
  const headerOpacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    requestLocationPermission();
    // Animation d'entrée du header
    Animated.parallel([
      Animated.timing(headerOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(headerAnim, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (location) fetchNearbyQueues();
    }, [location])
  );

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Géolocalisation requise', 'Activez la localisation pour voir les files à proximité.', [{ text: 'OK' }]);
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
    if (error) { setLoading(false); setRefreshing(false); return; }

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
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  };

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const openJoinModal = async (queue: Queue) => {
    setSelectedQueue(queue);
    if (isAuthenticated) {
      const { data: existing } = await supabase
        .from('queue_entries')
        .select('id')
        .eq('queue_id', queue.id)
        .eq('user_id', user?.id)
        .eq('status', 'waiting')
        .maybeSingle();

      if (existing) {
        Alert.alert('Déjà inscrit', "Vous êtes déjà dans cette file d'attente.", [
          { text: 'Voir ma position', onPress: () => navigation.navigate('ActiveQueue', { entryId: existing.id, queueId: queue.id }) },
          { text: 'OK' }
        ]);
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

    if (getDistance(location.latitude, location.longitude, target.latitude, target.longitude) > RADIUS_KM) {
      Alert.alert('Trop loin', `Vous devez être à moins de ${RADIUS_KM} km pour rejoindre cette file.`);
      return;
    }

    if (!isAuthenticated) {
      const { data: existing } = await supabase
        .from('queue_entries')
        .select('id')
        .eq('queue_id', target.id)
        .eq('session_id', guestSessionId)
        .eq('status', 'waiting')
        .maybeSingle();

      if (existing) {
        Alert.alert('Déjà inscrit', "Vous êtes déjà dans cette file d'attente.", [
          { text: 'Voir ma position', onPress: () => navigation.navigate('ActiveQueue', { entryId: existing.id, queueId: target.id }) },
          { text: 'OK' }
        ]);
        setJoinModalVisible(false);
        return;
      }
    }

    const displayName = isAuthenticated ? user?.user_metadata?.full_name || user?.email : guestName.trim();
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
    if (error) { Alert.alert('Erreur', error.message); return; }

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
        transform: [{
          translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [24 + index * 8, 0] })
        }],
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
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={DARK_BG} />

      {/* ── Header bleu nuit (même palette que LoginScreen) ─────────────── */}
      <Animated.View
        style={[
          styles.header,
          { opacity: headerOpacity, transform: [{ translateY: headerAnim }] },
        ]}
      >
        {/* Cercles décoratifs (identiques au splash/login) */}
        <View style={styles.headerCircle1} />
        <View style={styles.headerCircle2} />

        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerGreeting}>
              {isAuthenticated
                ? `Bonjour, ${user?.user_metadata?.full_name?.split(' ')[0] || 'vous'} 👋`
                : 'Bienvenue 👋'}
            </Text>
            <Text style={styles.headerTitle}>Files à proximité</Text>
          </View>
          {isAuthenticated && (
            <TouchableOpacity
              style={styles.createBtn}
              onPress={() => navigation.navigate('CreateQueue')}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Barre de localisation intégrée dans le header */}
        <View style={styles.locationBar}>
          <View style={styles.locationPill}>
            <Ionicons name="location" size={13} color={BRAND} />
            <Text style={styles.locationText}>
              {location ? `Rayon ${RADIUS_KM} km` : 'Localisation...'}
            </Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countText}>
              {queues.length} file{queues.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* ── Corps de page (fond clair) ───────────────────────────────────── */}
      <View style={styles.body}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color={BRAND} />
              <Text style={styles.loadingText}>Recherche des files...</Text>
            </View>
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
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="search-outline" size={36} color={BRAND} />
                </View>
                <Text style={styles.emptyTitle}>Aucune file trouvée</Text>
                <Text style={styles.emptySubtitle}>
                  Aucune file d'attente dans un rayon de {RADIUS_KM} km autour de vous.
                </Text>
                {isAuthenticated && (
                  <TouchableOpacity
                    style={styles.createFromEmpty}
                    onPress={() => navigation.navigate('CreateQueue')}
                  >
                    <Ionicons name="add-circle-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.createFromEmptyText}>Créer une file</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        )}
      </View>

      {/* ── Modal rejoindre (invité) ─────────────────────────────────────── */}
      <Modal visible={joinModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {/* En-tête modal style login */}
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalIconCircle}>
                <Ionicons name="enter-outline" size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Rejoindre la file</Text>
                <Text style={styles.modalQueueName} numberOfLines={1}>
                  {selectedQueue?.name}
                </Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Ionicons name="person-outline" size={18} color={GRAY} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Votre nom"
                placeholderTextColor={GRAY}
                value={guestName}
                onChangeText={setGuestName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Ionicons name="mail-outline" size={18} color={GRAY} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Votre email"
                placeholderTextColor={GRAY}
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
                  <Text style={styles.joinBtnText}>Rejoindre la file</Text>
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
  safe: { flex: 1, backgroundColor: DARK_BG },

  header: {
    backgroundColor: DARK_BG,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  
  headerCircle1: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(26, 115, 232, 0.1)',
    top: -60,
    right: -50,
  },
  headerCircle2: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(26, 115, 232, 0.07)',
    bottom: -30,
    left: -30,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  headerGreeting: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  createBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    marginTop: 4,
  },
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 115, 232, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(26, 115, 232, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  locationText: { fontSize: 13, color: '#6AABFF', fontWeight: '600' },
  countPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  countText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },

  // ── Body ───
  body: {
    flex: 1,
    backgroundColor: LIGHT_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    // Ombre de séparation header/body
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  list: { padding: 16, paddingTop: 20, paddingBottom: 100 },

  // ── Loading ────────
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  loadingText: { color: GRAY, fontSize: 15, fontWeight: '500' },

  // ── Empty ───────
  emptyContainer: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: DARK_BG, marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: GRAY, textAlign: 'center', lineHeight: 21 },
  createFromEmpty: {
    marginTop: 28,
    backgroundColor: BRAND,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  createFromEmptyText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // ── Modal ──────
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 28, 63, 0.6)',
  },
  modalSheet: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 44,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E5F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  modalIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: DARK_BG },
  modalQueueName: { fontSize: 13, color: BRAND, fontWeight: '600', marginTop: 2 },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: 50, fontSize: 15, color: DARK_BG, fontWeight: '500' },
  joinBtn: {
    backgroundColor: BRAND,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 6,
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  joinBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', marginTop: 16, paddingVertical: 8 },
  cancelBtnText: { color: '#E74C3C', fontSize: 15, fontWeight: '600' },
});