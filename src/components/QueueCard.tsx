import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Queue } from '../services/supabase';

type QueueWithCount = Queue & { waitingCount: number };

type QueueCardProps = {
  queue: QueueWithCount;
  onPress: () => void;
  distance?: number; // optionnel, en km
};

export default function QueueCard({ queue, onPress, distance }: QueueCardProps) {
  const getWaitingStatusColor = (count: number) => {
    if (count === 0) return '#2ecc71';
    if (count < 5) return '#f39c12';
    return '#e74c3c';
  };

  const formatDistance = (dist?: number) => {
    if (dist === undefined) return '...';
    if (dist < 1) return `${(dist * 1000).toFixed(0)} m`;
    return `${dist.toFixed(1)} km`;
  };

  const getEstimatedWaitTime = (count: number) => {
    const minutes = count * 2;
    if (minutes === 0) return 'Immédiat';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins > 0 ? ` ${mins}min` : ''}`;
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.queueName} numberOfLines={1}>
        {queue.name}
      </Text>

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
          <Text style={styles.statValue}>{formatDistance(distance)}</Text>
          <Text style={styles.statLabel}>distance</Text>
        </View>
      </View>

      <View style={[styles.statusBadge, { backgroundColor: getWaitingStatusColor(queue.waitingCount) }]}>
        <Text style={styles.statusText}>
          {queue.waitingCount === 0 ? 'Disponible' : queue.waitingCount < 5 ? 'Affluence modérée' : 'Très fréquenté'}
        </Text>
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
  queueName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
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
  statusBadge: {
    alignSelf: 'flex-start',
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