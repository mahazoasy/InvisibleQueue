import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Queue } from '../services/supabase';

type QueueCardProps = {
  queue: Queue & { waitingCount: number; distance?: number };
  onPress: () => void;
  loading?: boolean;
  isCreator?: boolean;
  onManagePress?: () => void;
};

export default function QueueCard({ 
  queue, 
  onPress, 
  loading = false, 
  isCreator = false,
  onManagePress 
}: QueueCardProps) {
  const getWaitingStatusColor = (count: number) => {
    if (count === 0) return '#2ecc71';
    if (count < 5) return '#f39c12';
    return '#e74c3c';
  };

  const formatDistance = (distance?: number) => {
    if (distance === undefined) return 'Calcul...';
    if (distance < 1) return `${(distance * 1000).toFixed(0)} m`;
    return `${distance.toFixed(1)} km`;
  };

  const getEstimatedWaitTime = (count: number) => {
    // Estimation approximative : 2 minutes par personne
    const minutes = count * 2;
    if (minutes === 0) return 'Immédiat';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins > 0 ? ` ${mins}min` : ''}`;
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={styles.queueName} numberOfLines={1}>
          {queue.name}
        </Text>
        {isCreator && (
          <TouchableOpacity 
            style={styles.manageButton} 
            onPress={onManagePress}
            disabled={loading}
          >
            <Text style={styles.manageButtonText}>Gérer</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{queue.waitingCount}</Text>
          <Text style={styles.statLabel}>en attente</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{getEstimatedWaitTime(queue.waitingCount)}</Text>
          <Text style={styles.statLabel}>temps estimé</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatDistance(queue.distance)}</Text>
          <Text style={styles.statLabel}>distance</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={[styles.statusBadge, { backgroundColor: getWaitingStatusColor(queue.waitingCount) }]}>
          <Text style={styles.statusText}>
            {queue.waitingCount === 0 ? 'Disponible' : queue.waitingCount < 5 ? 'Affluence modérée' : 'Très fréquenté'}
          </Text>
        </View>
        {loading && <ActivityIndicator size="small" color="#3498db" />}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  queueName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
    marginRight: 10,
  },
  manageButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  manageButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#ddd',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});