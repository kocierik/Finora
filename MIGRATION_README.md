# Migrazione Database - Struttura Categorie

Questo documento descrive come migrare il database per utilizzare la nuova struttura delle categorie con una tabella separata.

## Struttura Nuova

### Tabella `categories`
- `id` (UUID, PK)
- `user_id` (UUID, FK to auth.users)
- `name` (TEXT) - Nome della categoria
- `icon` (TEXT) - Icona emoji
- `color` (TEXT) - Colore esadecimale
- `sort_order` (INTEGER) - Ordine di visualizzazione
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### Tabella `expenses` (aggiornata)
- Aggiunto campo `category_id` (UUID, FK to categories)
- Il campo `category` (TEXT) rimane per compatibilità ma sarà deprecato

## Passi per la Migrazione

### 1. Creare la nuova struttura
Eseguire il file `migration_categories.sql`:
```sql
-- Questo crea la tabella categories e aggiunge category_id a expenses
\i migration_categories.sql
```

### 2. Migrare i dati delle categorie
Eseguire il file `migrate_categories_data.sql`:
```sql
-- Questo popola la tabella categories dai dati esistenti in profiles.categories_config
\i migrate_categories_data.sql
```

### 3. Aggiornare le spese esistenti
Eseguire il file `migrate_expenses_categories.sql`:
```sql
-- Questo aggiorna le spese esistenti per usare category_id
\i migrate_expenses_categories.sql
```

### 4. Verificare la migrazione
Controllare che:
- Tutte le categorie siano state migrate correttamente
- Tutte le spese abbiano un `category_id` valido
- L'applicazione funzioni correttamente con la nuova struttura

### 5. Pulizia (opzionale)
Dopo aver verificato che tutto funziona, puoi rimuovere il campo `category` dalla tabella `expenses`:
```sql
ALTER TABLE public.expenses DROP COLUMN category;
```

## Vantaggi della Nuova Struttura

1. **Normalizzazione**: Le categorie sono ora in una tabella separata
2. **Flessibilità**: È possibile modificare nome, icona e colore di una categoria senza toccare tutte le spese
3. **Performance**: Migliori performance con i join invece di stringhe
4. **Integrità**: Foreign key constraints garantiscono l'integrità dei dati
5. **Scalabilità**: Più facile aggiungere nuove proprietà alle categorie

## Note per lo Sviluppo

- Il codice è stato aggiornato per utilizzare la nuova struttura
- È stata mantenuta la compatibilità con il vecchio sistema durante la transizione
- Il campo `category` legacy è ancora presente ma non più utilizzato
- Tutte le query ora utilizzano i join con la tabella `categories`
