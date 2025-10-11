import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/Card';
import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

export function ListItemCard({
  title,
  subtitle,
  right,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string; right?: React.ReactNode }>) {
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.texts}>
          <ThemedText type="defaultSemiBold">{title}</ThemedText>
          {subtitle ? <ThemedText style={styles.subtitle}>{subtitle}</ThemedText> : null}
          {children}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center' },
  texts: { flex: 1, gap: 4 },
  subtitle: { opacity: 0.7, fontSize: 12 },
  right: { marginLeft: 12, alignItems: 'flex-end' },
})


