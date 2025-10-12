import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/Card';
import { Brand } from '@/constants/branding';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';

interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedMonthOffset: number;
  onMonthSelect: (offset: number) => void;
}

const months = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

export function DatePickerModal({ 
  visible, 
  onClose, 
  selectedMonthOffset, 
  onMonthSelect 
}: DatePickerModalProps) {
  const [displayYear, setDisplayYear] = useState(new Date().getFullYear());
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 50,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleMonthSelect = (offset: number) => {
    onMonthSelect(offset);
    onClose();
  };

  const handleQuickAction = (offset: number) => {
    // Reset to current year when selecting "Oggi"
    if (offset === 0) {
      setDisplayYear(new Date().getFullYear());
    }
    handleMonthSelect(offset);
  };

  const getMonthYear = (offset: number) => {
    const date = new Date();
    date.setMonth(date.getMonth() + offset);
    return {
      month: months[date.getMonth()],
      year: date.getFullYear(),
    };
  };

  const generateMonthOptions = () => {
    const options = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    
    if (displayYear === currentYear) {
      // Show only months from January to current month for current year
      for (let i = 0; i <= currentMonth; i++) {
        const offset = i - currentMonth;
        const monthYear = getMonthYear(offset);
        const isSelected = offset === selectedMonthOffset;
        const isCurrentMonth = offset === 0;
        
        options.push({
          offset: offset,
          month: monthYear.month,
          year: monthYear.year,
          isSelected,
          isCurrentMonth,
          isDisabled: false,
        });
      }
    } else {
      // Show all 12 months for previous years
      for (let i = 0; i < 12; i++) {
        const date = new Date(displayYear, i, 1);
        const offset = (displayYear - currentYear) * 12 + (i - currentMonth);
        const monthYear = getMonthYear(offset);
        const isSelected = offset === selectedMonthOffset;
        const isCurrentMonth = false; // Not current month if different year
        
        options.push({
          offset: offset,
          month: monthYear.month,
          year: monthYear.year,
          isSelected,
          isCurrentMonth,
          isDisabled: false,
        });
      }
    }
    
    return options;
  };

  const monthOptions = generateMonthOptions();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim }
              ],
            },
          ]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Card style={styles.modalCard} glow="rgba(6, 182, 212, 0.1)">
              <LinearGradient
                colors={['rgba(15, 15, 20, 0.95)', 'rgba(20, 20, 25, 0.95)']}
                style={styles.modalGradient}
              />
              
              {/* Header */}
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Seleziona Mese</ThemedText>
                <Pressable style={styles.closeButton} onPress={onClose}>
                  <ThemedText style={styles.closeIcon}>✕</ThemedText>
                </Pressable>
              </View>

              {/* Year Selector */}
              <View style={styles.yearSelector}>
                <Pressable 
                  style={styles.yearButton}
                  onPress={() => setDisplayYear(displayYear - 1)}
                >
                  <ThemedText style={styles.yearButtonText}>‹</ThemedText>
                </Pressable>
                <ThemedText style={styles.yearText}>{displayYear}</ThemedText>
                <Pressable 
                  style={[
                    styles.yearButton,
                    displayYear >= new Date().getFullYear() && styles.yearButtonDisabled
                  ]}
                  onPress={() => displayYear < new Date().getFullYear() && setDisplayYear(displayYear + 1)}
                  disabled={displayYear >= new Date().getFullYear()}
                >
                  <ThemedText style={[
                    styles.yearButtonText,
                    displayYear >= new Date().getFullYear() && styles.yearButtonTextDisabled
                  ]}>›</ThemedText>
                </Pressable>
              </View>

              {/* Month Grid */}
              <ScrollView 
                style={styles.monthGrid}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.monthGridContent}
              >
                {monthOptions.map((option) => (
                  <TouchableOpacity
                    key={`${option.year}-${option.offset}`}
                    style={[
                      styles.monthOption,
                      option.isSelected && styles.monthOptionSelected,
                      option.isDisabled && styles.monthOptionDisabled,
                    ]}
                    onPress={() => !option.isDisabled && handleMonthSelect(option.offset)}
                    disabled={option.isDisabled}
                  >
                    <View style={styles.monthOptionContent}>
                      <ThemedText style={[
                        styles.monthOptionText,
                        option.isSelected && styles.monthOptionTextSelected,
                        option.isDisabled && styles.monthOptionTextDisabled,
                      ]}>
                        {option.month}
                      </ThemedText>
                      <ThemedText style={[
                        styles.monthOptionYear,
                        option.isSelected && styles.monthOptionYearSelected,
                        option.isDisabled && styles.monthOptionYearDisabled,
                      ]}>
                        {option.year}
                      </ThemedText>
                    </View>
                    {option.isSelected && (
                      <View style={styles.selectedIndicator}>
                        <ThemedText style={styles.selectedIcon}>✓</ThemedText>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Quick Actions */}
              <View style={styles.quickActions}>
                <Pressable 
                  style={styles.quickActionButton}
                  onPress={() => handleQuickAction(0)}
                >
                  <ThemedText style={styles.quickActionText}>Oggi</ThemedText>
                </Pressable>
                <Pressable 
                  style={styles.quickActionButton}
                  onPress={() => handleQuickAction(-1)}
                >
                  <ThemedText style={styles.quickActionText}>Mese Scorso</ThemedText>
                </Pressable>
              </View>
            </Card>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalCard: {
    borderRadius: 24,
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  modalGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Brand.colors.text.primary,
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.colors.text.secondary,
  },
  yearSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  yearButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  yearButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: Brand.colors.text.secondary,
  },
  yearButtonDisabled: {
    opacity: 0.4,
  },
  yearButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  yearText: {
    fontSize: 18,
    fontWeight: '600',
    color: Brand.colors.text.primary,
  },
  monthGrid: {
    maxHeight: 300,
  },
  monthGridContent: {
    paddingBottom: 16,
  },
  monthOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  monthOptionSelected: {
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  monthOptionDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderColor: 'rgba(255, 255, 255, 0.04)',
    opacity: 0.4,
  },
  monthOptionContent: {
    flex: 1,
  },
  monthOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.colors.text.primary,
    marginBottom: 2,
  },
  monthOptionTextSelected: {
    color: '#06b6d4',
  },
  monthOptionYear: {
    fontSize: 13,
    fontWeight: '500',
    color: Brand.colors.text.secondary,
  },
  monthOptionYearSelected: {
    color: 'rgba(6, 182, 212, 0.8)',
  },
  monthOptionTextDisabled: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  monthOptionYearDisabled: {
    color: 'rgba(255, 255, 255, 0.2)',
  },
  currentMonthIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  currentMonthText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#06b6d4',
  },
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#06b6d4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedIcon: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.colors.text.primary,
  },
});
