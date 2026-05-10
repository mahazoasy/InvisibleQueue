import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, QueueEntry, Queue } from '../services/supabase';
import { clearActiveEntry } from '../utils/storage';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';

type ActiveQueueRouteProp = RouteProp<RootStackParamList, 'ActiveQueue'>;
type Props = { route: ActiveQueueRouteProp; navigation: any };

export default function ActiveQueueScreen({ route, navigation }: Props) {
  const { entryId, queueId } = route.params;
  const [entry, setEntry] = useState<QueueEntry | null>(null);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [totalWaiting, setTotalWaiting] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);
  const [lastNotifiedThreshold, setLastNotifiedThreshold] = useState<number>(0);
  const [actionLoading, setActionLoading] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const notifAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    fetchData();
    const sub = subscribeToRealtime();
    startPulse();
    return () => {
      sub?.unsubscribe();
      supabase.removeAllChannels();
    };
  }, []);

  useEffect(() => {
    if (notification) {
      Animated.spring(notifAnim, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 6 }).start();
      const t = setTimeout(() => {
        Animated.timing(notifAnim, { toValue: -100, duration: 300, useNativeDriver: true }).start(() =>
          setNotification(null)
        );
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  };

  const fetchData = async () => {
    try {
      const { data: entryData, error: e1 } = await supabase
        .from('queue_entries').select('*').eq('id', entryId).single();
      if (e1) throw e1;

      const { data: queueData, error: e2 } = await supabase
        .from('queues').select('*').eq('id', queueId).single();
      if (e2) throw e2;

      setEntry(entryData);
      setQueue(queueData);
      await updatePosition(entryData);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger votre position');
      navigation.goBack();
    }
  };

  const updatePosition = async (currentEntry: QueueEntry | null) => {
    if (!currentEntry) return;
    const { data: waitingEntries } = await supabase
      .from('queue_entries')
      .select('queue_order, id')
      .eq('queue_id', queueId)
      .eq('status', 'waiting')
      .order('queue_order', { ascending: true });

    if (waitingEntries) {
      const pos = waitingEntries.findIndex(e => e.id === currentEntry.id) + 1;
      setPosition(pos);
      setTotalWaiting(waitingEntries.length);

      // Notifications selon le nombre de personnes devant
      if (currentEntry.status === 'waiting') {
        if (pos <= 3 && lastNotifiedThreshold !== 3) {
          setNotification(`⚡ Vous êtes en position ${pos} — Préparez-vous !`);
          setLastNotifiedThreshold(3);
        } else if (pos <= 6 && pos > 3 && lastNotifiedThreshold !== 6) {
          setNotification(`⏳ Plus que ${pos - 1} personne(s) devant vous. Restez proche !`);
          setLastNotifiedThreshold(6);
        } else if (pos <= 10 && pos > 6 && lastNotifiedThreshold !== 10) {
          const waitMin = (pos - 1) * 2;
          setNotification(`🕒 Environ ${waitMin} minute${waitMin > 1 ? 's' : ''} d'attente.`);
          setLastNotifiedThreshold(10);
        }
      }
    }
    setLoading(false);
  };

  const subscribeToRealtime = () => {
    return supabase
      .channel(`queue_${queueId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries', filter: `queue_id=eq.${queueId}` },
        async (payload) => {
          const newEntry = payload.new as QueueEntry | null;
          if (newEntry && newEntry.id === entryId) {
            setEntry(newEntry);
            if (newEntry.status !== 'waiting') {
              Alert.alert(
                'File terminée',
                newEntry.status === 'served'
                  ? 'C\'est votre tour ! Vous avez été servi.'
                  : 'Vous avez été exclu après 3 retards.'
              );
              await clearActiveEntry();
              navigation.replace('Home');
              return;
            }
          }
          if (entry) await updatePosition(entry);
        })
      .subscribe();
  };

  const handleLeaveQueue = () => {
    Alert.alert('Quitter la file', 'Êtes-vous sûr de vouloir quitter cette file ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Quitter',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('queue_entries').update({ status: 'left' }).eq('id', entryId);
          await clearActiveEntry();
          navigation.replace('Home');
        },
      },
    ]);
  };

  // Nouvelle fonction : marquer comme servi (son tour est passé)
  const handleServed = () => {
    Alert.alert(
      'Confirmer',
      'Avez-vous bien été servi(e) ? Cela retirera votre place de la file.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Oui, servi',
          onPress: async () => {
            setActionLoading(true);
            const { error } = await supabase
              .from('queue_entries')
              .update({ status: 'served' })
              .eq('id', entryId);
            setActionLoading(false);
            if (error) {
              Alert.alert('Erreur', error.message);
            } else {
              await clearActiveEntry();
              navigation.replace('Home');
            }
          },
        },
      ]
    );
  };

  // Nouvelle fonction : reculer volontairement à la fin de la file
  const handleMoveToBack = () => {
    Alert.alert(
      'Reculer dans la file',
      'Voulez-vous vraiment passer en dernière position ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Oui, reculer',
          onPress: async () => {
            setActionLoading(true);
            const { error } = await supabase.rpc('move_to_back', { entry_id: entryId });
            setActionLoading(false);
            if (error) {
              Alert.alert('Erreur', error.message);
            } else {
              Alert.alert('Succès', 'Vous avez été déplacé à la fin de la file.');
            }
          },
        },
      ]
    );
  };

  const getEstimatedWait = (pos: number) => {
    const minutes = (pos - 1) * 2;
    if (minutes === 0) return 'Immédiat';
    if (minutes < 60) return `~${minutes} min`;
    return `~${Math.floor(minutes / 60)}h${minutes % 60 > 0 ? ` ${minutes % 60}min` : ''}`;
  };

  const getPositionColor = (pos: number | null) => {
    if (!pos) return '#1A73E8';
    if (pos === 1) return '#2ECC71';
    if (pos <= 3) return '#F39C12';
    return '#1A73E8';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1A73E8" />
          <Text style={styles.loadingText}>Chargement de votre position...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (entry?.status !== 'waiting') {
    const statusConfig: Record<string, { icon: string; title: string; subtitle: string; color: string }> = {
      served: { icon: 'checkmark-circle', title: 'Servi !', subtitle: 'C\'était votre tour. Merci d\'avoir utilisé Invisible Queue.', color: '#2ECC71' },
      excluded: { icon: 'close-circle', title: 'Exclu', subtitle: 'Vous avez manqué 3 tours consécutifs.', color: '#E74C3C' },
      left: { icon: 'exit-outline', title: 'File quittée', subtitle: 'Vous avez quitté cette file d\'attente.', color: '#8A94A6' },
    };
    const config = statusConfig[entry?.status || ''] || { icon: 'help-circle', title: entry?.status, subtitle: '', color: '#8A94A6' };

    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.statusContainer}>
          <Ionicons name={config.icon as any} size={80} color={config.color} />
          <Text style={[styles.statusTitle, { color: config.color }]}>{config.title}</Text>
          <Text style={styles.statusSubtitle}>{config.subtitle}</Text>
          <TouchableOpacity style={styles.homeBtn} onPress={() => navigation.replace('Home')}>
            <Ionicons name="home-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.homeBtnText}>Retour à l'accueil</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const posColor = getPositionColor(position);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F9FC" />

      {notification && (
        <Animated.View style={[styles.notifBanner, { transform: [{ translateY: notifAnim }] }]}>
          <Text style={styles.notifText}>{notification}</Text>
        </Animated.View>
      )}

      <View style={styles.container}>
        <View style={styles.queueHeader}>
          <Text style={styles.queueName} numberOfLines={2}>{queue?.name}</Text>
          <View style={styles.waitingBadge}>
            <Ionicons name="people-outline" size={14} color="#1A73E8" />
            <Text style={styles.waitingBadgeText}>{totalWaiting} en attente</Text>
          </View>
        </View>

        <Animated.View style={[styles.positionCard, { transform: [{ scale: pulseAnim }], borderColor: posColor }]}>
          <Text style={styles.positionLabel}>Votre position</Text>
          <Text style={[styles.positionNumber, { color: posColor }]}>{position}</Text>
          <Text style={styles.positionSub}>sur {totalWaiting} personne{totalWaiting > 1 ? 's' : ''}</Text>
        </Animated.View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="people-outline" size={22} color="#1A73E8" />
            <Text style={styles.statValue}>{Math.max(0, (position ?? 1) - 1)}</Text>
            <Text style={styles.statLabel}>devant vous</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={22} color="#1A73E8" />
            <Text style={styles.statValue}>{getEstimatedWait(position ?? 1)}</Text>
            <Text style={styles.statLabel}>attente estimée</Text>
          </View>
        </View>

        {totalWaiting > 0 && (
          <View style={styles.progressContainer}>
            <Text style={styles.progressLabel}>Progression de la file</Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.max(5, ((totalWaiting - (position ?? 1) + 1) / totalWaiting) * 100)}%`,
                    backgroundColor: posColor,
                  },
                ]}
              />
            </View>
          </View>
        )}

        <View style={styles.infoNote}>
          <Ionicons name="information-circle-outline" size={16} color="#8A94A6" />
          <Text style={styles.infoNoteText}>
            Restez à proximité. Vous serez notifié à l'approche de votre tour.
          </Text>
        </View>

        <View style={styles.spacer} />

        {/* Nouveaux boutons d'action */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.servedBtn, actionLoading && styles.actionDisabled]}
            onPress={handleServed}
            disabled={actionLoading}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.actionBtnText}>J'ai été servi</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.backBtn, actionLoading && styles.actionDisabled]}
            onPress={handleMoveToBack}
            disabled={actionLoading}
            activeOpacity={0.85}
          >
            <Ionicons name="return-down-back-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.actionBtnText}>Reculer en fin de file</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.leaveBtn} onPress={handleLeaveQueue} activeOpacity={0.85}>
          <Ionicons name="exit-outline" size={20} color="#E74C3C" style={{ marginRight: 8 }} />
          <Text style={styles.leaveBtnText}>Quitter la file</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F9FC' },
  container: { flex: 1, padding: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 15, color: '#8A94A6', fontWeight: '500' },
  statusContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  statusTitle: { fontSize: 28, fontWeight: '800', marginTop: 20, marginBottom: 10 },
  statusSubtitle: { fontSize: 15, color: '#8A94A6', textAlign: 'center', lineHeight: 22 },
  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A73E8',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginTop: 32,
  },
  homeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  notifBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: '#F39C12',
    paddingTop: 54,
    paddingBottom: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  notifText: { color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  queueHeader: { marginBottom: 24 },
  queueName: { fontSize: 24, fontWeight: '800', color: '#0F1C3F', marginBottom: 8 },
  waitingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF4FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 5,
  },
  waitingBadgeText: { fontSize: 13, color: '#1A73E8', fontWeight: '600' },
  positionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 3,
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  positionLabel: { fontSize: 14, color: '#8A94A6', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  positionNumber: { fontSize: 80, fontWeight: '900', lineHeight: 88 },
  positionSub: { fontSize: 14, color: '#8A94A6', marginTop: 6, fontWeight: '500' },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statCard: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 20, fontWeight: '800', color: '#0F1C3F' },
  statLabel: { fontSize: 12, color: '#8A94A6', fontWeight: '500' },
  statDivider: { width: 1, backgroundColor: '#E8EBF2', marginHorizontal: 8 },
  progressContainer: { marginBottom: 20 },
  progressLabel: { fontSize: 13, color: '#8A94A6', fontWeight: '600', marginBottom: 8 },
  progressTrack: { height: 8, backgroundColor: '#E8EBF2', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F4F6FB',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  infoNoteText: { flex: 1, fontSize: 13, color: '#8A94A6', lineHeight: 18 },
  spacer: { flex: 1 },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 3,
  },
  servedBtn: {
    backgroundColor: '#2ECC71',
  },
  backBtn: {
    backgroundColor: '#F39C12',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  actionDisabled: {
    opacity: 0.6,
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E74C3C',
    backgroundColor: '#FFF5F5',
  },
  leaveBtnText: { color: '#E74C3C', fontSize: 16, fontWeight: '700' },
});