import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase, QueueEntry } from '../services/supabase';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';

type ManageQueueRouteProp = RouteProp<RootStackParamList, 'ManageQueue'>;
type ManageQueueNavigationProp = StackNavigationProp<RootStackParamList, 'ManageQueue'>;
type Props = { route: ManageQueueRouteProp };

export default function ManageQueueScreen({ route }: Props) {
  const { queueId, queueName } = route.params;
  const navigation = useNavigation<ManageQueueNavigationProp>();
  const [waitingEntries, setWaitingEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [servedCount, setServedCount] = useState(0);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleDeleteQueue} style={{ marginRight: 16 }}>
          <Ionicons name="trash-outline" size={22} color="#E74C3C" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    fetchEntries();
    fetchServedCount();
    const unsub = subscribeToQueue();
    return unsub;
  }, []);

  const fetchEntries = async () => {
    const { data, error } = await supabase
      .from('queue_entries')
      .select('*')
      .eq('queue_id', queueId)
      .eq('status', 'waiting')
      .order('queue_order', { ascending: true });
    if (!error && data) setWaitingEntries(data);
    setLoading(false);
  };

  const fetchServedCount = async () => {
    const { count } = await supabase
      .from('queue_entries')
      .select('*', { count: 'exact', head: true })
      .eq('queue_id', queueId)
      .eq('status', 'served');
    setServedCount(count || 0);
  };

  const subscribeToQueue = () => {
    const subscription = supabase
      .channel(`manage_${queueId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'queue_entries',
        filter: `queue_id=eq.${queueId}`,
      }, () => {
        fetchEntries();
        fetchServedCount();
      })
      .subscribe();
    return () => subscription.unsubscribe();
  };

  const handleServe = (entryId: string, displayName: string) => {
    Alert.alert(
      'Confirmer',
      `Marquer ${displayName} comme servi(e) ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Servi ✓',
          onPress: async () => {
            await supabase.from('queue_entries').update({ status: 'served' }).eq('id', entryId);
          },
        },
      ]
    );
  };

  const handleMissed = async (entryId: string, displayName: string) => {
    Alert.alert(
      'Absent',
      `${displayName} n'est pas présent(e) ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Absent',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.rpc('handle_missed', { entry_id: entryId });
            if (error) Alert.alert('Erreur', error.message);
          },
        },
      ]
    );
  };

  const handleDeleteQueue = () => {
    Alert.alert(
      'Supprimer la file',
      `Voulez-vous supprimer définitivement "${queueName}" ? Toutes les personnes en attente seront retirées.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('queue_entries').delete().eq('queue_id', queueId);
              await supabase.from('queues').delete().eq('id', queueId);
              navigation.replace('Home');
            } catch (error: any) {
              Alert.alert('Erreur', error.message);
            }
          },
        },
      ]
    );
  };

  const getMissedColor = (missed: number) => {
    if (missed === 0) return '#2ECC71';
    if (missed === 1) return '#F39C12';
    if (missed === 2) return '#E67E22';
    return '#E74C3C';
  };

  const renderEntry = ({ item, index }: { item: QueueEntry; index: number }) => (
    <View style={[styles.entryCard, index === 0 && styles.entryCardFirst]}>
      {/* Position badge + Info */}
      <View style={styles.entryLeft}>
        <View style={[styles.positionBadge, index === 0 && styles.positionBadgeFirst]}>
          {index === 0 ? (
            <Ionicons name="star" size={14} color="#FFFFFF" />
          ) : (
            <Text style={styles.positionText}>{index + 1}</Text>
          )}
        </View>
        <View style={styles.entryInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{item.display_name}</Text>
            {index === 0 && (
              <View style={styles.nextBadge}>
                <Text style={styles.nextBadgeText}>Prochain</Text>
              </View>
            )}
          </View>
          <Text style={styles.email} numberOfLines={1}>{item.email}</Text>
          <View style={styles.missedRow}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.missedDot,
                  { backgroundColor: i < item.missed_count ? getMissedColor(item.missed_count) : '#E0E5F0' },
                ]}
              />
            ))}
            <Text style={[styles.missedLabel, { color: getMissedColor(item.missed_count) }]}>
              {item.missed_count}/3 retard{item.missed_count !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.serveBtn}
          onPress={() => handleServe(item.id, item.display_name)}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark" size={18} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.missBtn}
          onPress={() => handleMissed(item.id, item.display_name)}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F9FC" />
      <View style={styles.container}>

        {/* Stats Bar */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{waitingEntries.length}</Text>
            <Text style={styles.statLabel}>En attente</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#2ECC71' }]}>{servedCount}</Text>
            <Text style={styles.statLabel}>Servi(s)</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {waitingEntries.length > 0 ? `~${waitingEntries.length * 2} min` : '—'}
            </Text>
            <Text style={styles.statLabel}>Temps total</Text>
          </View>
        </View>

        {/* Next to serve label */}
        {waitingEntries.length > 0 && (
          <Text style={styles.sectionLabel}>File d'attente</Text>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1A73E8" />
            <Text style={styles.loadingText}>Chargement de la file...</Text>
          </View>
        ) : waitingEntries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={64} color="#2ECC71" />
            <Text style={styles.emptyTitle}>File vide</Text>
            <Text style={styles.emptySubtitle}>
              Tout le monde a été servi. La file est libre.
            </Text>
          </View>
        ) : (
          <FlatList
            data={waitingEntries}
            keyExtractor={(item) => item.id}
            renderItem={renderEntry}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F9FC' },
  container: { flex: 1 },

  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#0F1C3F',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  statLabel: { fontSize: 11, color: '#8A94A6', marginTop: 2, fontWeight: '500' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 4 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8A94A6',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },

  list: { paddingHorizontal: 16, paddingBottom: 32 },

  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  entryCardFirst: {
    borderWidth: 2,
    borderColor: '#1A73E8',
    shadowColor: '#1A73E8',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },

  entryLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },

  positionBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F0F2F8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  positionBadgeFirst: {
    backgroundColor: '#1A73E8',
  },
  positionText: { fontSize: 16, fontWeight: '800', color: '#4A5568' },

  entryInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  name: { fontSize: 15, fontWeight: '700', color: '#0F1C3F', flex: 1 },
  nextBadge: {
    backgroundColor: '#EEF4FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  nextBadgeText: { fontSize: 11, color: '#1A73E8', fontWeight: '700' },
  email: { fontSize: 12, color: '#8A94A6', marginBottom: 6 },

  missedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  missedDot: { width: 8, height: 8, borderRadius: 4 },
  missedLabel: { fontSize: 11, fontWeight: '600', marginLeft: 4 },

  actions: { flexDirection: 'row', gap: 8, marginLeft: 10 },
  serveBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#2ECC71',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2ECC71',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  missBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E67E22',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E67E22',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 15, color: '#8A94A6', fontWeight: '500' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#0F1C3F' },
  emptySubtitle: { fontSize: 14, color: '#8A94A6', textAlign: 'center', lineHeight: 20 },
});