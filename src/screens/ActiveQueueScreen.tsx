import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabase, QueueEntry, Queue } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { clearActiveEntry } from '../utils/storage';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';

type ActiveQueueRouteProp = RouteProp<RootStackParamList, 'ActiveQueue'>;

type Props = {
  route: ActiveQueueRouteProp;
  navigation: any;
};

export default function ActiveQueueScreen({ route, navigation }: Props) {
  const { entryId, queueId } = route.params;
  const [entry, setEntry] = useState<QueueEntry | null>(null);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [totalWaiting, setTotalWaiting] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    subscribeToRealtime();

    return () => {
      supabase.removeAllChannels();
    };
  }, []);

  const fetchData = async () => {
    const { data: entryData, error: entryError } = await supabase
      .from('queue_entries')
      .select('*')
      .eq('id', entryId)
      .single();

    if (entryError) {
      Alert.alert('Erreur', 'Impossible de charger votre position');
      navigation.goBack();
      return;
    }

    const { data: queueData } = await supabase
      .from('queues')
      .select('*')
      .eq('id', queueId)
      .single();

    setEntry(entryData);
    setQueue(queueData);
    await updatePosition(entryData);
  };

  const updatePosition = async (currentEntry: QueueEntry) => {
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

      if (pos <= 3 && pos > 0 && currentEntry.status === 'waiting') {
        setNotification(`⚠️ Vous êtes position ${pos} - Préparez-vous !`);
        setTimeout(() => setNotification(null), 5000);
      }
    }
    setLoading(false);
  };

  const subscribeToRealtime = () => {
    const subscription = supabase
      .channel(`queue_${queueId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'queue_entries',
        filter: `queue_id=eq.${queueId}`,
      }, async (payload) => {
        if (payload.new && payload.new.id === entryId) {
          setEntry(payload.new as QueueEntry);
          if ((payload.new as QueueEntry).status !== 'waiting') {
            Alert.alert('File terminée', 'Vous avez été servi ou exclu de la file.');
            await clearActiveEntry();
            navigation.replace('Home');
          }
        }
        await updatePosition((payload.new?.id === entryId ? payload.new : entry) as QueueEntry);
      })
      .subscribe();

    return () => subscription.unsubscribe();
  };

  const handleLeaveQueue = async () => {
    Alert.alert('Quitter la file', 'Êtes-vous sûr de vouloir quitter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Quitter',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('queue_entries').update({ status: 'left' }).eq('id', entryId);
          await clearActiveEntry();
          navigation.replace('Home');
        }
      }
    ]);
  };

  if (loading) return <ActivityIndicator size="large" style={styles.loader} />;

  if (entry?.status !== 'waiting') {
    return (
      <View style={styles.container}>
        <Text style={styles.statusText}>Statut: {entry?.status}</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.replace('Home')}>
          <Text style={styles.buttonText}>Retour à l'accueil</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {notification && <View style={styles.notification}><Text style={styles.notificationText}>{notification}</Text></View>}
      <Text style={styles.queueName}>{queue?.name}</Text>
      <View style={styles.positionCard}>
        <Text style={styles.positionLabel}>Votre position</Text>
        <Text style={styles.positionNumber}>{position}</Text>
        <Text style={styles.totalWaiting}>sur {totalWaiting} personne(s)</Text>
      </View>
      <Text style={styles.info}>Devant vous: {position! - 1} personne(s)</Text>
      <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveQueue}>
        <Text style={styles.leaveButtonText}>Quitter la file</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5', alignItems: 'center' },
  loader: { flex: 1, justifyContent: 'center' },
  queueName: { fontSize: 24, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' },
  positionCard: { backgroundColor: '#3498db', padding: 30, borderRadius: 20, alignItems: 'center', width: '100%', marginBottom: 20 },
  positionLabel: { color: 'white', fontSize: 18, marginBottom: 10 },
  positionNumber: { color: 'white', fontSize: 64, fontWeight: 'bold' },
  totalWaiting: { color: 'white', fontSize: 16, marginTop: 10 },
  info: { fontSize: 18, marginBottom: 40, color: '#2c3e50' },
  leaveButton: { backgroundColor: '#e74c3c', padding: 15, borderRadius: 8, width: '100%', alignItems: 'center' },
  leaveButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  button: { backgroundColor: '#3498db', padding: 15, borderRadius: 8, marginTop: 20, width: '100%', alignItems: 'center' },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  notification: { backgroundColor: '#f39c12', padding: 12, borderRadius: 8, marginBottom: 20, width: '100%' },
  notificationText: { color: 'white', textAlign: 'center', fontWeight: 'bold' },
  statusText: { fontSize: 20, textAlign: 'center', marginTop: 50 },
});