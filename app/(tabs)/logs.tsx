import { ThemedText } from '@/components/themed-text'
import { Brand, UI as UI_CONSTANTS } from '@/constants/branding'
import { useSettings } from '@/context/SettingsContext'
import { LogEntry, logger, LogLevel } from '@/services/logger'
import { Ionicons } from '@expo/vector-icons'
import React, { useCallback, useEffect, useState } from 'react'
import {
    Alert,
    FlatList,
    Platform,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function LogsScreen() {
  const { t, language } = useSettings()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([])
  const [selectedLevel, setSelectedLevel] = useState<LogLevel | 'ALL'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  // Sottoscrivi ai log
  useEffect(() => {
    console.log('[LogsScreen] 🔍 Subscribing to logger...')
    console.log('[LogsScreen] 🔍 Logger object:', logger)
    console.log('[LogsScreen] 🔍 Logger.info:', logger?.info)
    
    const unsubscribe = logger.subscribe((newLogs) => {
      console.log('[LogsScreen] 📝 Received logs:', newLogs.length)
      console.log('[LogsScreen] 📝 Logs content:', newLogs)
      setLogs(newLogs)
    })
    
    // Aggiungi un log di test
    if (logger && logger.info) {
      console.log('[LogsScreen] ✅ Logger is working, adding test log')
      logger.info('Logs screen initialized', { timestamp: Date.now() }, 'LogsScreen')
    } else {
      console.log('[LogsScreen] ❌ Logger is not working properly')
    }
    
    return unsubscribe
  }, [])

  // Filtra i log
  useEffect(() => {
    let filtered = logs

    // Filtro per livello
    if (selectedLevel !== 'ALL') {
      filtered = filtered.filter(log => log.level === selectedLevel)
    }

    // Filtro per ricerca
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(query) ||
        log.source.toLowerCase().includes(query) ||
        (log.data && JSON.stringify(log.data).toLowerCase().includes(query))
      )
    }

    setFilteredLogs(filtered)
  }, [logs, selectedLevel, searchQuery])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    // I log vengono aggiornati automaticamente tramite subscription
    setTimeout(() => setRefreshing(false), 500)
  }, [])

  const clearLogs = () => {
    Alert.alert(
      t('clear_logs'),
      t('clear_logs_confirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        { 
          text: t('clear'), 
          style: 'destructive',
          onPress: () => logger.clear()
        }
      ]
    )
  }

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case 'ERROR': return '#ef4444'
      case 'WARN': return '#f59e0b'
      case 'INFO': return '#3b82f6'
      case 'DEBUG': return '#6b7280'
      default: return '#6b7280'
    }
  }

  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
      case 'ERROR': return 'alert-circle'
      case 'WARN': return 'warning'
      case 'INFO': return 'information-circle'
      case 'DEBUG': return 'bug'
      default: return 'help-circle'
    }
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString(language === 'it' ? 'it-IT' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }

  const renderLogItem = ({ item }: { item: LogEntry }) => (
    <View style={styles.logItem}>
      <View style={styles.logHeader}>
        <View style={styles.logLevelContainer}>
          <Ionicons 
            name={getLevelIcon(item.level) as any} 
            size={16} 
            color={getLevelColor(item.level)} 
          />
          <Text style={[styles.logLevel, { color: getLevelColor(item.level) }]}>
            {item.level}
          </Text>
        </View>
        <Text style={styles.logTimestamp}>{formatTimestamp(item.timestamp)}</Text>
      </View>
      
      <Text style={styles.logSource}>{item.source}</Text>
      <Text style={styles.logMessage}>{item.message}</Text>
      
      {item.data && (
        <View style={styles.logDataContainer}>
          <Text style={styles.logData}>
            {typeof item.data === 'string' ? item.data : JSON.stringify(item.data, null, 2)}
          </Text>
        </View>
      )}
    </View>
  )

  const renderFilterButton = (level: LogLevel | 'ALL', label: string) => (
    <TouchableOpacity
      key={level}
      style={[
        styles.filterButton,
        selectedLevel === level && styles.filterButtonActive
      ]}
      onPress={() => setSelectedLevel(level)}
    >
      <Text style={[
        styles.filterButtonText,
        selectedLevel === level && styles.filterButtonTextActive
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>{t('logs')}</ThemedText>
        <TouchableOpacity style={styles.clearButton} onPress={clearLogs}>
          <Ionicons name="trash-outline" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* Filtri */}
      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          {renderFilterButton('ALL', t('all'))}
          {renderFilterButton('ERROR', 'ERROR')}
          {renderFilterButton('WARN', 'WARN')}
          {renderFilterButton('INFO', 'INFO')}
          {renderFilterButton('DEBUG', 'DEBUG')}
        </View>
        
        <TextInput
          style={styles.searchInput}
          placeholder={t('search_logs')}
          placeholderTextColor="#6b7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Statistiche */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          {t('total_logs')}: {logs.length} | {t('filtered')}: {filteredLogs.length}
        </Text>
      </View>

      {/* Lista log */}
      <FlatList
        data={filteredLogs}
        keyExtractor={(item) => item.id}
        renderItem={renderLogItem}
        style={styles.logsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color="#6b7280" />
            <Text style={styles.emptyText}>{t('no_logs')}</Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: UI_CONSTANTS.GLASS_BORDER,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Brand.colors.text.primary,
  },
  clearButton: {
    padding: 8,
  },
  filtersContainer: {
    padding: 16,
    gap: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: UI_CONSTANTS.GLASS_BG,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.GLASS_BORDER,
  },
  filterButtonActive: {
    backgroundColor: Brand.colors.primary,
    borderColor: Brand.colors.primary,
  },
  filterButtonText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },
  searchInput: {
    backgroundColor: UI_CONSTANTS.GLASS_BG,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: UI_CONSTANTS.GLASS_BORDER,
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  statsText: {
    color: '#6b7280',
    fontSize: 12,
  },
  logsList: {
    flex: 1,
  },
  logItem: {
    backgroundColor: UI_CONSTANTS.GLASS_BG,
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#6b7280',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  logLevelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logLevel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  logTimestamp: {
    color: '#6b7280',
    fontSize: 11,
  },
  logSource: {
    color: '#9ca3af',
    fontSize: 11,
    marginBottom: 4,
  },
  logMessage: {
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 8,
  },
  logDataContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  logData: {
    color: '#d1d5db',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 16,
    marginTop: 12,
  },
})