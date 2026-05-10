import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Queue } from '../services/supabase';

type QueueWithCount = Queue & { waitingCount: number };
type QueueCardProps = {
  queue: QueueWithCount;
  onPress: () => void;
  onManage?: () => void;      
  distance?: number;
  isCreator?: boolean;        
};

export default function QueueCard({ queue, onPress, onManage, distance, isCreator }: QueueCardProps) {
  const getStatusConfig = (count: number) => {
    if (count === 0) return { color: '#2ECC71', bg: '#E8FAF0', label: 'Disponible', icon: 'checkmark-circle' };
    if (count < 5) return { color: '#F39C12', bg: '#FEF6E4', label: 'Affluence modérée', icon: 'time' };
    return { color: '#E74C3C', bg: '#FDECEA', label: 'Très fréquenté', icon: 'alert-circle' };
  };

  const formatDistance = (dist?: number) => {
    if (dist === undefined) return '—';
    if (dist < 1) return `${(dist * 1000).toFixed(0)} m`;
    return `${dist.toFixed(1)} km`;
  };

  const getEstimatedWait = (count: number) => {
    const minutes = count * 2;
    if (minutes === 0) return 'Immédiat';
    if (minutes < 60) return `~${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `~${h}h${m > 0 ? `${m}m` : ''}`;
  };

  const status = getStatusConfig(queue.waitingCount);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* En-tête */}
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>{queue.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Ionicons name={status.icon as any} size={12} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {/* Ligne de statistiques */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <View style={[styles.statIconWrap, { backgroundColor: '#EEF4FF' }]}>
            <Ionicons name="people-outline" size={16} color="#1A73E8" />
          </View>
          <Text style={styles.statValue}>{queue.waitingCount}</Text>
          <Text style={styles.statLabel}>en attente</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <View style={[styles.statIconWrap, { backgroundColor: '#FEF6E4' }]}>
            <Ionicons name="time-outline" size={16} color="#F39C12" />
          </View>
          <Text style={styles.statValue}>{getEstimatedWait(queue.waitingCount)}</Text>
          <Text style={styles.statLabel}>estimé</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <View style={[styles.statIconWrap, { backgroundColor: '#E8FAF0' }]}>
            <Ionicons name="location-outline" size={16} color="#2ECC71" />
          </View>
          <Text style={styles.statValue}>{formatDistance(distance)}</Text>
          <Text style={styles.statLabel}>distance</Text>
        </View>
      </View>

      {/* Pied de carte */}
      <View style={styles.footer}>
        <View style={[styles.dot, { backgroundColor: status.color }]} />
        <Text style={styles.footerText}>
          {isCreator ? 'Vous êtes le gestionnaire' : 'Appuyez pour rejoindre'}
        </Text>
        {isCreator && onManage && (
          <TouchableOpacity onPress={onManage} style={styles.manageButton}>
            <Text style={styles.manageButtonText}>Gérer</Text>
            <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        {!isCreator && <Ionicons name="chevron-forward" size={16} color="#C5CDE0" />}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#1A3A6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F1C3F',
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#F7F9FC',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 14,
  },
  stat: { flex: 1, alignItems: 'center', gap: 6 },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 15, fontWeight: '800', color: '#0F1C3F' },
  statLabel: { fontSize: 11, color: '#8A94A6', fontWeight: '500' },
  statDivider: { width: 1, backgroundColor: '#E0E5F0', marginVertical: 4 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  footerText: { flex: 1, fontSize: 13, color: '#8A94A6', fontWeight: '500' },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A73E8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  manageButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});