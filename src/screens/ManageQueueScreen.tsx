import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase, QueueEntry } from '../services/supabase';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';

type ManageQueueRouteProp = RouteProp<RootStackParamList, 'ManageQueue'>;
type ManageQueueNavigationProp = StackNavigationProp<RootStackParamList, 'ManageQueue'>;

type Props = {
  route: ManageQueueRouteProp;
};

export default function ManageQueueScreen({ route }: Props) {
  const { queueId, queueName } = route.params;
  const navigation = useNavigation<ManageQueueNavigationProp>(); 
  const [waitingEntries, setWaitingEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleDeleteQueue} style={{ marginRight: 16 }}>
          <Ionicons name="trash-outline" size={24} color="#E74C3C" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    fetchEntries();
    subscribeToQueue();
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

  const subscribeToQueue = () => {
    const subscription = supabase
      .channel(`manage_${queueId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'queue_entries',
        filter: `queue_id=eq.${queueId}`,
      }, () => fetchEntries())
      .subscribe();

    return () => subscription.unsubscribe();
  };

  const handleServe = async (entryId: string) => {
    await supabase.from('queue_entries').update({ status: 'served' }).eq('id', entryId);
    Alert.alert('Succès', 'Utilisateur marqué comme servi');
  };

  const handleMissed = async (entryId: string) => {
    const { error } = await supabase.rpc('handle_missed', { entry_id: entryId });
    if (error) {
      Alert.alert('Erreur', error.message);
    } else {
      Alert.alert('Retard', "L'utilisateur recule de 3 positions");
    }
  };

  const handleDeleteQueue = async () => {
    Alert.alert(
      'Supprimer la file',
      `Êtes-vous sûr de vouloir supprimer définitivement la file "${queueName}" ?\nToutes les personnes en attente seront également supprimées.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              // Supprimer d'abord les entrées associées
              const { error: entriesError } = await supabase
                .from('queue_entries')
                .delete()
                .eq('queue_id', queueId);
              if (entriesError) throw entriesError;
              
              // Supprimer la file
              const { error: queueError } = await supabase
                .from('queues')
                .delete()
                .eq('id', queueId);
              if (queueError) throw queueError;
              
              Alert.alert('Succès', 'File supprimée avec succès');
              // Retourner à l'écran d'accueil et vider la pile
              navigation.replace('Home');
            } catch (error: any) {
              Alert.alert('Erreur', error.message);
            }
          }
        }
      ]
    );
  };

  const renderEntry = ({ item, index }: { item: QueueEntry; index: number }) => (
    <View style={styles.entryCard}>
      <View style={styles.entryInfo}>
        <Text style={styles.position}>#{index + 1}</Text>
        <Text style={styles.name}>{item.display_name}</Text>
        <Text style={styles.email}>{item.email}</Text>
        <Text style={styles.missed}>Retards: {item.missed_count}/3</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.actionBtn, styles.serveBtn]} onPress={() => handleServe(item.id)}>
          <Text style={styles.actionText}>Servi</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.missBtn]} onPress={() => handleMissed(item.id)}>
          <Text style={styles.actionText}>Absent</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) return <Text style={styles.loading}>Chargement...</Text>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gestion de: {queueName}</Text>
      <Text style={styles.subtitle}>Prochain à servir:</Text>
      {waitingEntries.length === 0 ? (
        <Text style={styles.empty}>Aucune personne en attente</Text>
      ) : (
        <FlatList
          data={waitingEntries}
          keyExtractor={(item) => item.id}
          renderItem={renderEntry}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { fontSize: 18, marginBottom: 15, color: '#666' },
  list: { paddingBottom: 20 },
  entryCard: { backgroundColor: 'white', borderRadius: 12, padding: 15, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryInfo: { flex: 1 },
  position: { fontSize: 18, fontWeight: 'bold', color: '#3498db' },
  name: { fontSize: 16, fontWeight: 'bold', marginTop: 5 },
  email: { fontSize: 12, color: '#666' },
  missed: { fontSize: 12, color: '#e74c3c', marginTop: 4 },
  actions: { flexDirection: 'row' },
  actionBtn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8, marginLeft: 10 },
  serveBtn: { backgroundColor: '#2ecc71' },
  missBtn: { backgroundColor: '#e67e22' },
  actionText: { color: 'white', fontWeight: 'bold' },
  loading: { textAlign: 'center', marginTop: 50, fontSize: 16 },
  empty: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#999' },
});