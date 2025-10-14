import AsyncStorage from "@react-native-async-storage/async-storage"

export type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG"

export interface LogEntry {
  id: string
  timestamp: number
  level: LogLevel
  message: string
  data?: any
  source: string
}

class Logger {
  private logs: LogEntry[] = []
  private maxLogs = 1000
  private listeners: ((logs: LogEntry[]) => void)[] = []

  constructor() {
    this.loadLogs()
  }

  private async loadLogs() {
    try {
      const stored = await AsyncStorage.getItem("@finora:logs")
      if (stored) {
        this.logs = JSON.parse(stored)
      }
    } catch (error) {
      console.log("[Logger] Failed to load logs:", error)
    }
  }

  private async saveLogs() {
    try {
      await AsyncStorage.setItem("@finora:logs", JSON.stringify(this.logs))
    } catch (error) {
      console.log("[Logger] Failed to save logs:", error)
    }
  }

  private addLog(level: LogLevel, message: string, data?: any, source: string = "App") {
    const logEntry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      level,
      message,
      data,
      source
    }

    this.logs.unshift(logEntry)
    
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs)
    }

    this.listeners.forEach(listener => listener([...this.logs]))
    this.saveLogs()
  }

  info(message: string, data?: any, source?: string) {
    this.addLog("INFO", message, data, source)
  }

  warn(message: string, data?: any, source?: string) {
    this.addLog("WARN", message, data, source)
  }

  error(message: string, data?: any, source?: string) {
    this.addLog("ERROR", message, data, source)
  }

  debug(message: string, data?: any, source?: string) {
    this.addLog("DEBUG", message, data, source)
  }

  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  subscribe(listener: (logs: LogEntry[]) => void) {
    this.listeners.push(listener)
    listener([...this.logs])
    
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  clear() {
    this.logs = []
    this.listeners.forEach(listener => listener([]))
    this.saveLogs()
  }

  filterByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level)
  }

  filterBySource(source: string): LogEntry[] {
    return this.logs.filter(log => log.source === source)
  }
}

export const logger = new Logger()
