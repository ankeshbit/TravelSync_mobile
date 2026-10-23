import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useTrip,
  useTripExpenses,
  useTripBalances,
  useAddTripExpense,
  useDeleteTripExpense,
  useTripMembers,
} from '@/hooks/useTripDetails';
import { useAuth } from '@/context/AuthContext';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Theme } from '@/constants/theme';
import { Expense } from '@/types/trip';

const EXPENSE_CATEGORIES = [
  { id: 'food', label: 'Food & Dining', icon: 'restaurant-outline' },
  { id: 'stay', label: 'Accommodation', icon: 'bed-outline' },
  { id: 'transport', label: 'Transport', icon: 'car-outline' },
  { id: 'activity', label: 'Activities', icon: 'ticket-outline' },
  { id: 'shopping', label: 'Shopping', icon: 'bag-outline' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

export default function TripExpensesScreen() {
  const { id, tripId: paramTripId } = useLocalSearchParams<{ id?: string; tripId?: string }>();
  const tripId = id || paramTripId || '';

  const { user } = useAuth();
  const { data: trip, isLoading: tripLoading } = useTrip(tripId);
  const {
    data: expenses = [],
    isLoading: expensesLoading,
    refetch: refetchExpenses,
    isRefetching,
  } = useTripExpenses(tripId);
  const { data: balances, refetch: refetchBalances } = useTripBalances(tripId);
  const { data: members = [] } = useTripMembers(tripId);

  const addExpenseMutation = useAddTripExpense(tripId);
  const deleteExpenseMutation = useDeleteTripExpense(tripId);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');
  const [selectedSplits, setSelectedSplits] = useState<string[]>([]);
  const [paidById, setPaidById] = useState<string>('');

  const allMembers = [
    ...(trip?.owner ? [{ id: trip.owner.id, name: trip.owner.name, email: trip.owner.email, isOwner: true }] : []),
    ...members.map((m) => ({ id: m.userId, name: m.user?.name || 'Member', email: m.user?.email || '', isOwner: false })),
  ];

  const onRefresh = async () => {
    await Promise.all([refetchExpenses(), refetchBalances()]);
  };

  const handleOpenAddModal = () => {
    setTitle('');
    setAmount('');
    setCategory('food');
    setPaidById(user?.id || trip?.ownerId || '');
    setSelectedSplits(allMembers.map((m) => m.id));
    setModalVisible(true);
  };

  const toggleSplitUser = (userId: string) => {
    if (selectedSplits.includes(userId)) {
      if (selectedSplits.length === 1) {
        Alert.alert('Notice', 'At least one person must be included in the expense split.');
        return;
      }
      setSelectedSplits(selectedSplits.filter((u) => u !== userId));
    } else {
      setSelectedSplits([...selectedSplits, userId]);
    }
  };

  const handleAddExpense = async () => {
    const numAmount = parseFloat(amount);
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter an expense title.');
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Required', 'Please enter a valid amount.');
      return;
    }
    if (!paidById) {
      Alert.alert('Required', 'Please select who paid for this expense.');
      return;
    }

    try {
      await addExpenseMutation.mutateAsync({
        title: title.trim(),
        amount: numAmount,
        currency: trip?.currency || 'INR',
        category,
        paidById,
        splitUserIds: selectedSplits,
      });

      setModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to add expense.');
    }
  };

  const handleDeleteExpense = (exp: Expense) => {
    Alert.alert('Delete Expense', `Delete "${exp.title}" (${exp.currency} ${exp.amount})?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteExpenseMutation.mutate(exp.id),
      },
    ]);
  };

  if (tripLoading || expensesLoading) {
    return <LoadingState message="Loading trip expenses..." fullscreen />;
  }

  if (!trip) {
    return <ErrorState title="Trip Not Found" message="Could not load expenses for this trip." onRetry={onRefresh} fullscreen />;
  }

  const totalSpent = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const budgetTotal = (trip.budgetPerPerson || 0) * (allMembers.length || 1);
  const budgetPercent = budgetTotal > 0 ? Math.min(100, Math.round((totalSpent / budgetTotal) * 100)) : 0;

  // Category breakdown
  const categoryTotals: Record<string, number> = {};
  expenses.forEach((e) => {
    const cat = (e.category || 'other').toLowerCase();
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(e.amount);
  });

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            colors={[Theme.colors.accent]}
            tintColor={Theme.colors.accent}
          />
        }
      >
        {/* Header Budget Card */}
        <Card style={styles.budgetCard}>
          <Text style={styles.budgetLabel}>TOTAL EXPENSES</Text>
          <Text style={styles.budgetSpent}>
            {trip.currency} {totalSpent.toLocaleString()}
          </Text>

          {budgetTotal > 0 && (
            <View style={styles.budgetProgressSection}>
              <View style={styles.budgetProgressRow}>
                <Text style={styles.budgetTotalText}>
                  Budget: {trip.currency} {budgetTotal.toLocaleString()} ({budgetPercent}%)
                </Text>
                <Text style={styles.budgetRemainingText}>
                  Remaining: {trip.currency} {Math.max(0, budgetTotal - totalSpent).toLocaleString()}
                </Text>
              </View>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${budgetPercent}%`,
                      backgroundColor:
                        budgetPercent > 90
                          ? Theme.colors.status.error
                          : budgetPercent > 70
                          ? Theme.colors.status.warning
                          : Theme.colors.accent,
                    },
                  ]}
                />
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.addExpenseBtn} onPress={handleOpenAddModal}>
            <Ionicons name="add" size={18} color={Theme.colors.accentText} />
            <Text style={styles.addExpenseBtnText}>Add Expense</Text>
          </TouchableOpacity>
        </Card>

        {/* Category Breakdown */}
        {Object.keys(categoryTotals).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Category Breakdown</Text>
            <View style={styles.categoryGrid}>
              {EXPENSE_CATEGORIES.map((cat) => {
                const amount = categoryTotals[cat.id] || 0;
                if (amount === 0) return null;
                return (
                  <View key={cat.id} style={styles.categoryChip}>
                    <Ionicons name={cat.icon as any} size={16} color={Theme.colors.accent} />
                    <Text style={styles.categoryName}>{cat.label}</Text>
                    <Text style={styles.categoryAmount}>
                      {trip.currency} {amount.toLocaleString()}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Debt Settlement Matrix ("Who Owes Whom") */}
        {balances?.settlements && balances.settlements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Debt Settlement (&quot;Who Owes Whom&quot;)</Text>
            <Card style={styles.settlementsCard}>
              {balances.settlements.map((s, idx) => (
                <View key={idx} style={styles.settlementRow}>
                  <View style={styles.settlementAvatars}>
                    <View style={styles.miniAvatar}>
                      <Text style={styles.miniAvatarText}>{s.fromName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={14} color={Theme.colors.accent} />
                    <View style={[styles.miniAvatar, { backgroundColor: Theme.colors.surfaceElevated }]}>
                      <Text style={styles.miniAvatarText}>{s.toName.charAt(0).toUpperCase()}</Text>
                    </View>
                  </View>

                  <View style={styles.settlementTextContainer}>
                    <Text style={styles.settlementDescription}>
                      <Text style={styles.boldName}>{s.fromName}</Text> owes <Text style={styles.boldName}>{s.toName}</Text>
                    </Text>
                  </View>

                  <Text style={styles.settlementAmount}>
                    {s.currency} {s.amount.toFixed(2)}
                  </Text>
                </View>
              ))}
            </Card>
          </View>
        )}

        {/* Expenses List */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>All Transactions ({expenses.length})</Text>

          {expenses.length === 0 ? (
            <EmptyState
              icon="wallet-outline"
              title="No Expenses Logged"
              message="Keep track of hotel, food, and transport costs together."
              actionLabel="Add First Expense"
              onAction={handleOpenAddModal}
            />
          ) : (
            expenses.map((exp) => (
              <Card key={exp.id} style={styles.expenseCard}>
                <View style={styles.expenseMain}>
                  <View style={styles.expenseCategoryIcon}>
                    <Ionicons
                      name={
                        (EXPENSE_CATEGORIES.find((c) => c.id === exp.category)?.icon as any) ||
                        'receipt-outline'
                      }
                      size={20}
                      color={Theme.colors.accent}
                    />
                  </View>

                  <View style={styles.expenseDetails}>
                    <Text style={styles.expenseTitle}>{exp.title}</Text>
                    <Text style={styles.expensePayer}>
                      Paid by {exp.paidBy?.name || 'Someone'} · Split with {(exp.splits || []).length} people
                    </Text>
                  </View>

                  <View style={styles.expenseRight}>
                    <Text style={styles.expenseValue}>
                      {exp.currency} {Number(exp.amount).toLocaleString()}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleDeleteExpense(exp)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="trash-outline" size={16} color={Theme.colors.status.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Expense Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Expense</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={Theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Input
                label="Expense Title"
                placeholder="e.g. Dinner in Shibuya"
                value={title}
                onChangeText={setTitle}
              />

              <Input
                label={`Amount (${trip.currency})`}
                placeholder="0.00"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
              />

              {/* Category Picker */}
              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.categoryPickerRow}>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryPickerChip,
                      category === cat.id && styles.categoryPickerChipActive,
                    ]}
                    onPress={() => setCategory(cat.id)}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={14}
                      color={category === cat.id ? Theme.colors.accentText : Theme.colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.categoryPickerText,
                        category === cat.id && styles.categoryPickerTextActive,
                      ]}
                    >
                      {cat.label.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Paid By Selection */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Paid By</Text>
              <View style={styles.memberSelectRow}>
                {allMembers.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[
                      styles.payerChip,
                      paidById === m.id && styles.payerChipActive,
                    ]}
                    onPress={() => setPaidById(m.id)}
                  >
                    <Text
                      style={[
                        styles.payerChipText,
                        paidById === m.id && styles.payerChipTextActive,
                      ]}
                    >
                      {m.name.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Split Members Checklist */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Split Equally Among</Text>
              <View style={styles.splitsList}>
                {allMembers.map((m) => {
                  const isChecked = selectedSplits.includes(m.id);
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={styles.splitRow}
                      onPress={() => toggleSplitUser(m.id)}
                    >
                      <Ionicons
                        name={isChecked ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={isChecked ? Theme.colors.accent : Theme.colors.textMuted}
                      />
                      <Text style={styles.splitUserName}>{m.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Button
                title="Save Expense"
                onPress={handleAddExpense}
                isLoading={addExpenseMutation.isPending}
                style={{ marginTop: 20 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  budgetCard: {
    padding: 20,
    marginBottom: 20,
    backgroundColor: Theme.colors.surface,
  },
  budgetLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Theme.colors.textMuted,
    letterSpacing: 0.8,
  },
  budgetSpent: {
    fontSize: 28,
    fontWeight: '800',
    color: Theme.colors.textPrimary,
    marginTop: 4,
    marginBottom: 12,
  },
  budgetProgressSection: {
    marginBottom: 16,
  },
  budgetProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  budgetTotalText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    fontWeight: '500',
  },
  budgetRemainingText: {
    fontSize: 12,
    color: Theme.colors.textMuted,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: Theme.colors.surfaceElevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  addExpenseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.accent,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    marginTop: 8,
  },
  addExpenseBtnText: {
    color: Theme.colors.accentText,
    fontWeight: '700',
    fontSize: 13,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  categoryName: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  categoryAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  settlementsCard: {
    padding: 12,
  },
  settlementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  settlementAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.colors.accentText,
  },
  settlementTextContainer: {
    flex: 1,
    paddingHorizontal: 10,
  },
  settlementDescription: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
  },
  boldName: {
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  settlementAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.status.warning,
  },
  expenseCard: {
    marginBottom: 10,
    padding: 14,
  },
  expenseMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseCategoryIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  expenseDetails: {
    flex: 1,
  },
  expenseTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    marginBottom: 2,
  },
  expensePayer: {
    fontSize: 12,
    color: Theme.colors.textMuted,
  },
  expenseRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  expenseValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.textMuted,
    marginBottom: 8,
  },
  categoryPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryPickerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    gap: 4,
  },
  categoryPickerChipActive: {
    backgroundColor: Theme.colors.accent,
    borderColor: Theme.colors.accent,
  },
  categoryPickerText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  categoryPickerTextActive: {
    color: Theme.colors.accentText,
    fontWeight: '700',
  },
  memberSelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  payerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  payerChipActive: {
    backgroundColor: Theme.colors.accent,
    borderColor: Theme.colors.accent,
  },
  payerChipText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  payerChipTextActive: {
    color: Theme.colors.accentText,
    fontWeight: '700',
  },
  splitsList: {
    gap: 10,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  splitUserName: {
    fontSize: 13,
    color: Theme.colors.textPrimary,
  },
});
