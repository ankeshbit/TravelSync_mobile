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
import { getErrorMessage } from '@/api/client';
import { useTripSocket } from '@/hooks/useTripSocket';
import { TripPresence } from '@/components/trips/TripPresence';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { BottomSheetModal } from '@/components/common/BottomSheetModal';
import { Theme } from '@/constants/theme';
import { Expense } from '@/types/trip';
import { parseAmount, filterSettlementsForCurrency } from '@/utils/money';

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
    isError: expensesError,
    refetch: refetchExpenses,
    isRefetching,
  } = useTripExpenses(tripId);
  const { data: balances, refetch: refetchBalances } = useTripBalances(tripId);
  const { data: members = [] } = useTripMembers(tripId);

  // Real-time socket presence & updates (automatic TanStack Query invalidation)
  const { activeMembers } = useTripSocket(tripId);

  const addExpenseMutation = useAddTripExpense(tripId);
  const deleteExpenseMutation = useDeleteTripExpense(tripId);

  // Modals & Currency State
  const [modalVisible, setModalVisible] = useState(false);
  const [settleModalVisible, setSettleModalVisible] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('');
  const [modalCurrency, setModalCurrency] = useState<string>('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');
  const [selectedSplits, setSelectedSplits] = useState<string[]>([]);
  const [paidById, setPaidById] = useState<string>('');

  const allMembers = [
    ...(trip?.owner ? [{ id: trip.owner.id, name: trip.owner.name, email: trip.owner.email, isOwner: true }] : []),
    ...members.map((m) => ({ id: m.userId, name: m.user?.name || 'Member', email: m.user?.email || '', isOwner: false })),
  ];

  // Available Currencies
  const availableCurrencies: string[] = (() => {
    const set = new Set<string>();
    if (trip?.currency) set.add(trip.currency.toUpperCase());
    if (balances?.currency) set.add(balances.currency.toUpperCase());
    if (balances?.byCurrency) {
      Object.keys(balances.byCurrency).forEach((c) => set.add(c.toUpperCase()));
    }
    expenses.forEach((e) => {
      if (e.currency) set.add(e.currency.toUpperCase());
    });
    if (set.size === 0) set.add('USD');
    return Array.from(set);
  })();

  const activeCurrency = selectedCurrency || availableCurrencies[0] || trip?.currency || 'USD';

  // Current Currency Data
  const currentCurrencyData = balances?.byCurrency?.[activeCurrency] || balances?.byCurrency?.[activeCurrency.toLowerCase()] || null;

  // Filtered Expenses
  const currentCurrencyExpenses = expenses.filter(
    (e) => (e.currency || trip?.currency || 'USD').toUpperCase() === activeCurrency.toUpperCase()
  );

  // Financial Stats
  const computedTotalExpenses = (() => {
    if (currentCurrencyData && currentCurrencyData.totalExpenses !== undefined) {
      return currentCurrencyData.totalExpenses;
    }
    return currentCurrencyExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  })();

  const computedYourShare = (() => {
    // Prefer server-provided per-member share from balances
    if (currentCurrencyData?.membersWithBalance && user?.id) {
      const myBalance = currentCurrencyData.membersWithBalance.find(
        (m: any) => m.id === user.id || m._id === user.id
      );
      if (myBalance?.share !== undefined) return Number(myBalance.share) || 0;
    }
    if (!user?.id || !currentCurrencyExpenses.length) return 0;
    return currentCurrencyExpenses.reduce((sum, item) => {
      const splits = item.splits && item.splits.length > 0 ? item.splits : [];
      if (splits.length === 0) return sum;
      const isIncluded = splits.some((s) => (s.userId || s.user?.id) === user.id);
      if (isIncluded) {
        return sum + (Number(item.amount) || 0) / splits.length;
      }
      return sum;
    }, 0);
  })();

  // Settlements
  const settlements: any[] = (() => {
    const raw: any[] = currentCurrencyData?.settlements || balances?.settlements || [];
    return filterSettlementsForCurrency(raw, activeCurrency);
  })();

  const computedYouOwe = (() => {
    if (!user?.id || !settlements.length) return 0;
    return settlements
      .filter((s) => s.from === user.id)
      .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  })();

  const computedYouAreOwed = (() => {
    if (!user?.id || !settlements.length) return 0;
    return settlements
      .filter((s) => s.to === user.id)
      .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  })();

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
    const numAmount = parseAmount(amount);
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter an expense title.');
      return;
    }
    if (numAmount === null || numAmount <= 0) {
      Alert.alert('Required', 'Please enter a valid amount (e.g. 12.50 or 12,50).');
      return;
    }
    if (!paidById) {
      Alert.alert('Required', 'Please select who paid for this expense.');
      return;
    }

    try {
      const finalCurrency = (modalCurrency || activeCurrency).toUpperCase().trim();
      await addExpenseMutation.mutateAsync({
        title: title.trim(),
        amount: numAmount,
        currency: finalCurrency,
        category,
        paidById,
        splitUserIds: selectedSplits,
      });

      setModalVisible(false);
    } catch (err: unknown) {
      Alert.alert('Error', getErrorMessage(err));
    }
  };

  const handleDeleteExpense = (exp: Expense) => {
    Alert.alert('Delete Expense', `Delete "${exp.title}" (${exp.currency} ${exp.amount})?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteExpenseMutation.mutate(exp.id, {
            onError: (err: unknown) =>
              Alert.alert('Error', getErrorMessage(err)),
          }),
      },
    ]);
  };

  if (tripLoading || expensesLoading) {
    return <LoadingState message="Loading trip expenses..." fullscreen />;
  }

  if (!trip) {
    return <ErrorState title="Trip Not Found" message="Could not load expenses for this trip." onRetry={onRefresh} fullscreen />;
  }

  // Category breakdown – unknown categories go under "other"
  const categoryTotals: Record<string, number> = {};
  const knownCatIds = new Set(EXPENSE_CATEGORIES.map((c) => c.id));
  currentCurrencyExpenses.forEach((e) => {
    const raw = (e.category || 'other').toLowerCase();
    const cat = knownCatIds.has(raw) ? raw : 'other';
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
        {/* Header Actions & Presence */}
        <View style={styles.headerBar}>
          <TripPresence activeMembers={activeMembers} />
          <View style={styles.headerActions}>
            {settlements.length > 0 && (
              <TouchableOpacity
                style={styles.settleUpHeaderBtn}
                onPress={() => setSettleModalVisible(true)}
              >
                <Ionicons name="swap-horizontal" size={16} color={Theme.colors.accent} />
                <Text style={styles.settleUpHeaderBtnText}>Settle Up</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.addHeaderBtn} onPress={handleOpenAddModal}>
              <Ionicons name="add" size={18} color={Theme.colors.accentText} />
              <Text style={styles.addHeaderBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Currency Tabs */}
        {availableCurrencies.length > 1 && (
          <View style={styles.currencyRow}>
            <Text style={styles.currencyLabel}>Currency:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.currencyTabs}>
              {availableCurrencies.map((curr) => {
                const isSelected = curr === activeCurrency;
                return (
                  <TouchableOpacity
                    key={curr}
                    style={[styles.currencyTab, isSelected && styles.currencyTabActive]}
                    onPress={() => setSelectedCurrency(curr)}
                  >
                    <Text style={[styles.currencyTabText, isSelected && styles.currencyTabTextActive]}>
                      {curr}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* 4 Stat Cards Row */}
        <View style={styles.statsGrid}>
          {/* Total Expenses */}
          <Card style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="receipt-outline" size={20} color={Theme.colors.textMuted} />
            </View>
            <View style={styles.statContent}>
              <Text style={styles.statLabel}>Total Expenses</Text>
              <Text style={styles.statValue}>
                {activeCurrency} {computedTotalExpenses.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </Text>
            </View>
          </Card>

          {/* Your Share */}
          <Card style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="pie-chart-outline" size={20} color={Theme.colors.textMuted} />
            </View>
            <View style={styles.statContent}>
              <Text style={styles.statLabel}>Your Share</Text>
              <Text style={styles.statValue}>
                {activeCurrency} {computedYourShare.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </Text>
            </View>
          </Card>

          {/* You Owe */}
          <Card style={[styles.statCard, computedYouOwe > 0 && styles.statCardOwe]}>
            <View style={[styles.statIconContainer, computedYouOwe > 0 && styles.statIconContainerOwe]}>
              <Ionicons
                name="arrow-down"
                size={20}
                color={computedYouOwe > 0 ? Theme.colors.status.error : Theme.colors.textMuted}
              />
            </View>
            <View style={styles.statContent}>
              <Text style={styles.statLabel}>You Owe</Text>
              <Text style={[styles.statValue, computedYouOwe > 0 && styles.statValueOwe]}>
                {activeCurrency} {computedYouOwe.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </Text>
            </View>
          </Card>

          {/* You Are Owed */}
          <Card style={[styles.statCard, computedYouAreOwed > 0 && styles.statCardOwed]}>
            <View style={[styles.statIconContainer, computedYouAreOwed > 0 && styles.statIconContainerOwed]}>
              <Ionicons
                name="arrow-up"
                size={20}
                color={computedYouAreOwed > 0 ? Theme.colors.status.success : Theme.colors.textMuted}
              />
            </View>
            <View style={styles.statContent}>
              <Text style={styles.statLabel}>You Are Owed</Text>
              <Text style={[styles.statValue, computedYouAreOwed > 0 && styles.statValueOwed]}>
                {activeCurrency} {computedYouAreOwed.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </Text>
            </View>
          </Card>
        </View>

        {/* Category Breakdown */}
        {Object.keys(categoryTotals).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Category Breakdown</Text>
            <View style={styles.categoryGrid}>
              {EXPENSE_CATEGORIES.map((cat) => {
                const catAmount = categoryTotals[cat.id] || 0;
                if (catAmount === 0) return null;
                return (
                  <View key={cat.id} style={styles.categoryChip}>
                    <Ionicons name={cat.icon as any} size={16} color={Theme.colors.accent} />
                    <Text style={styles.categoryName}>{cat.label}</Text>
                    <Text style={styles.categoryAmount}>
                      {activeCurrency} {catAmount.toLocaleString()}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Debt Settlement Matrix ("Who Owes Whom") */}
        {settlements.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Debt Settlement (&quot;Who Owes Whom&quot;)</Text>
              <TouchableOpacity onPress={() => setSettleModalVisible(true)}>
                <Text style={styles.sectionLink}>View Plan</Text>
              </TouchableOpacity>
            </View>
            <Card style={styles.settlementsCard}>
              {settlements.map((s, idx) => (
                <View key={idx} style={styles.settlementRow}>
                  <View style={styles.settlementAvatars}>
                    <View style={styles.miniAvatar}>
                      <Text style={styles.miniAvatarText}>{(s.fromName || 'U').charAt(0).toUpperCase()}</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={14} color={Theme.colors.accent} />
                    <View style={[styles.miniAvatar, { backgroundColor: Theme.colors.surfaceElevated }]}>
                      <Text style={styles.miniAvatarText}>{(s.toName || 'U').charAt(0).toUpperCase()}</Text>
                    </View>
                  </View>

                  <View style={styles.settlementTextContainer}>
                    <Text style={styles.settlementDescription}>
                      <Text style={styles.boldName}>{s.fromName || 'Someone'}</Text> owes <Text style={styles.boldName}>{s.toName || 'Someone'}</Text>
                    </Text>
                  </View>

                  <Text style={styles.settlementAmount}>
                    {s.currency || activeCurrency} {Number(s.amount).toFixed(2)}
                  </Text>
                </View>
              ))}
            </Card>
          </View>
        )}

        {/* Expenses List */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>All Transactions ({currentCurrencyExpenses.length})</Text>

          {expensesError ? (
            <ErrorState
              title="Failed to Load Expenses"
              message="Could not fetch transactions for this trip."
              onRetry={refetchExpenses}
            />
          ) : currentCurrencyExpenses.length === 0 ? (
            <EmptyState
              icon="wallet-outline"
              title="No Expenses Logged"
              message="Keep track of hotel, food, and transport costs together."
              actionLabel="Add First Expense"
              onAction={handleOpenAddModal}
            />
          ) : (
            currentCurrencyExpenses.map((exp) => (
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
                      {exp.currency || activeCurrency} {Number(exp.amount).toLocaleString()}
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
      <BottomSheetModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Add Expense"
      >
        <Input
          label="Expense Title"
          placeholder="e.g. Dinner in Shibuya"
          value={title}
          onChangeText={setTitle}
        />

        {/* Currency Selection Picker */}
        <Text style={styles.fieldLabel}>Currency</Text>
        <View style={styles.categoryPickerRow}>
          {availableCurrencies.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.categoryPickerChip,
                (modalCurrency || activeCurrency) === c && styles.categoryPickerChipActive,
              ]}
              onPress={() => setModalCurrency(c)}
            >
              <Text
                style={[
                  styles.categoryPickerText,
                  (modalCurrency || activeCurrency) === c && styles.categoryPickerTextActive,
                ]}
              >
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Input
          placeholder="Custom currency (e.g. JPY, EUR)"
          value={modalCurrency}
          onChangeText={(txt) => setModalCurrency(txt.toUpperCase().slice(0, 3))}
          autoCapitalize="characters"
          maxLength={3}
        />

        <Input
          label={`Amount (${(modalCurrency || activeCurrency).toUpperCase()})`}
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
      </BottomSheetModal>

      {/* Settle Up Modal */}
      <Modal visible={settleModalVisible} animationType="slide" transparent onRequestClose={() => setSettleModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Settlement Plan</Text>
                <Text style={styles.modalSubtitle}>Optimized debts for {activeCurrency}</Text>
              </View>
              <TouchableOpacity onPress={() => setSettleModalVisible(false)}>
                <Ionicons name="close" size={24} color={Theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              {settlements.length === 0 ? (
                <View style={styles.emptySettlementBox}>
                  <Ionicons name="checkmark-circle-outline" size={36} color={Theme.colors.status.success} />
                  <Text style={styles.emptySettlementText}>All settled up! No outstanding balances.</Text>
                </View>
              ) : (
                settlements.map((s, idx) => {
                  const isUserSender = user?.id && s.from === user.id;
                  const isUserReceiver = user?.id && s.to === user.id;
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.settleModalRow,
                        isUserSender && styles.settleModalRowUserSender,
                        isUserReceiver && styles.settleModalRowUserReceiver,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settleRowTitle}>
                          {isUserSender ? 'You' : s.fromName || 'Someone'}
                          {' → '}
                          {isUserReceiver ? 'You' : s.toName || 'Someone'}
                        </Text>
                        <Text style={styles.settleRowSubtitle}>
                          {isUserSender
                            ? 'You owe this amount'
                            : isUserReceiver
                            ? 'You receive this amount'
                            : 'Peer settlement'}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.settleRowAmount,
                          isUserSender && { color: Theme.colors.status.error },
                          isUserReceiver && { color: Theme.colors.status.success },
                        ]}
                      >
                        {activeCurrency} {Number(s.amount).toFixed(2)}
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <Button
              title="Close"
              variant="outline"
              onPress={() => setSettleModalVisible(false)}
              style={{ marginTop: 16 }}
            />
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settleUpHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  settleUpHeaderBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.textPrimary,
  },
  addHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  addHeaderBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Theme.colors.accentText,
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  currencyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.textMuted,
  },
  currencyTabs: {
    flexDirection: 'row',
    gap: 6,
  },
  currencyTab: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  currencyTabActive: {
    backgroundColor: Theme.colors.accent,
    borderColor: Theme.colors.accent,
  },
  currencyTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
  },
  currencyTabTextActive: {
    color: Theme.colors.accentText,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  statCardOwe: {
    borderColor: 'rgba(199, 127, 120, 0.4)',
  },
  statCardOwed: {
    borderColor: 'rgba(134, 169, 139, 0.4)',
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconContainerOwe: {
    backgroundColor: 'rgba(199, 127, 120, 0.15)',
  },
  statIconContainerOwed: {
    backgroundColor: 'rgba(134, 169, 139, 0.15)',
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Theme.colors.textMuted,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: Theme.colors.textPrimary,
    marginTop: 2,
  },
  statValueOwe: {
    color: Theme.colors.status.error,
  },
  statValueOwed: {
    color: Theme.colors.status.success,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLink: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.accent,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  emptySettlementBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptySettlementText: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
  },
  settleModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  settleModalRowUserSender: {
    borderColor: 'rgba(199, 127, 120, 0.5)',
    backgroundColor: 'rgba(199, 127, 120, 0.08)',
  },
  settleModalRowUserReceiver: {
    borderColor: 'rgba(134, 169, 139, 0.5)',
    backgroundColor: 'rgba(134, 169, 139, 0.08)',
  },
  settleRowTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  settleRowSubtitle: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  settleRowAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: Theme.colors.textPrimary,
    marginLeft: 8,
  },
});
