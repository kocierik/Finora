import { UI as UI_CONSTANTS } from '@/constants/branding'
import { DEFAULT_CATEGORIES, PREDEFINED_CATEGORIES_MAP, translateCategoryName } from '@/constants/categories'
import { useSettings } from '@/context/SettingsContext'
import { Expense } from '@/types'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef } from 'react'
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Defs, FeGaussianBlur, FeMerge, FeMergeNode, Filter, G, Path, Text as SvgText } from 'react-native-svg'

type CategoryData = {
  name: string;
  amount: number;
  percentage: number;
  color: string;
  icon: string;
  startAngle: number;
  endAngle: number;
}

type CategoryBase = {
  name: string;
  amount: number;
  percentage: number;
  color: string;
  icon: string;
}

const categories = DEFAULT_CATEGORIES.map(c => ({ name: c.name, color: c.color, icon: c.icon }))

export function ExpensesPie({ items, selectedYear, selectedMonth }: { 
  items: Expense[], 
  selectedYear: number, 
  selectedMonth: number 
}) {
  const { categories: configuredCategories, language } = useSettings()
  const animatedValues = useRef(categories.map(() => new Animated.Value(0))).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  // Animation effects - MUST be before any conditional returns
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Update animations when data changes
  useEffect(() => {
    // Reset and re-animate when data changes
    animatedValues.forEach(anim => anim.setValue(0));
    
    Animated.stagger(100, animatedValues.map(anim => 
      Animated.timing(anim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      })
    )).start();
  }, [items, selectedYear, selectedMonth]);

  // Filter for selected month only
  const sameMonth = (dateStr: string, year: number, monthIndex: number) => {
    if (!dateStr) return false;
    const parts = dateStr.includes('/') ? dateStr.split('/') : [];
    let d: Date;
    if (parts.length >= 3) {
      const dd = parseInt(parts[0], 10);
      const mm = parseInt(parts[1], 10) - 1;
      const yyyy = parseInt(parts[2], 10);
      d = new Date(yyyy, mm, dd);
    } else {
      d = new Date(dateStr);
    }
    return d.getFullYear() === year && d.getMonth() === monthIndex;
  };
  
  const currentMonthItems = items.filter(e => sameMonth(e.date, selectedYear, selectedMonth));
  
  const byCat = currentMonthItems.reduce<Record<string, number>>((acc, e) => {
    // Use the new category structure: prefer categories.name, fallback to category
    const key = e.categories?.name ?? e.category ?? 'Other';
    acc[key] = (acc[key] ?? 0) + e.amount;
    return acc;
  }, {});

  // Create a case-insensitive mapping
  const byCatLower = Object.keys(byCat).reduce<Record<string, number>>((acc, key) => {
    acc[key.toLowerCase()] = byCat[key];
    return acc;
  }, {});
  
  const totalAmount = Object.values(byCat).reduce((sum, amount) => sum + amount, 0);
  

  // Calculate angles for each category
  let currentAngle = -90; // Start from top
  
  // Create a map of predefined categories for quick lookup
  const predefinedCategories = new Map(
    categories.map(cat => [cat.name.toLowerCase(), cat])
  );

  // Map of user-configured categories (icon/color override)
  const userCategories = new Map(
    (configuredCategories || []).map(c => [
      (c.name || '').toLowerCase(),
      { name: c.name, icon: c.icon, color: c.color }
    ])
  )

  // Map of categories from the new structure (from expenses.categories)
  const expenseCategories = new Map(
    currentMonthItems
      .filter(e => e.categories)
      .map(e => [
        (e.categories?.name || '').toLowerCase(),
        { name: e.categories?.name, icon: e.categories?.icon, color: e.categories?.color }
      ])
  )
  
  // Get all unique categories from the data
  const allCategoriesFromData = Object.keys(byCat);
  
  // Create category data for all categories that have amounts > 0
  let categoryData: CategoryBase[] = allCategoriesFromData
    .filter(catName => byCat[catName] > 0)
    .map(catName => {
      const amount = byCat[catName];
      const percentage = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
      
      // Prefer expense categories (from the new structure) if present
      const expenseCategory = expenseCategories.get(catName.toLowerCase());
      if (expenseCategory && expenseCategory.name) {
        return {
          name: expenseCategory.name,
          amount,
          percentage,
          color: expenseCategory.color || '#10b981',
          icon: (expenseCategory.icon ?? '')
        };
      }
      
      // Then check user-configured category if present
      const userConfigured = userCategories.get(catName.toLowerCase());
      if (userConfigured) {
        return {
          name: userConfigured.name,
          amount,
          percentage,
          color: userConfigured.color || '#10b981',
          icon: (userConfigured.icon ?? '')
        };
      }
      // Otherwise, check predefined defaults
      const predefined = PREDEFINED_CATEGORIES_MAP.get(catName.toLowerCase());
      if (predefined) {
        return {
          name: predefined.name,
          amount,
          percentage,
          color: predefined.color,
          icon: predefined.icon
        };
      }
      
      // For unknown categories, assign a default color and icon
      const defaultColors = UI_CONSTANTS.CHART_DEFAULT_COLORS;
      const defaultIcons = UI_CONSTANTS.CHART_DEFAULT_ICONS;
      const colorIndex = allCategoriesFromData.indexOf(catName) % defaultColors.length;
      
      return {
        name: catName,
        amount,
        percentage,
        color: defaultColors[colorIndex],
        icon: defaultIcons[colorIndex]
      };
    })
    .sort((a, b) => b.amount - a.amount); // Sort by amount descending


  // If no categories have data but there's a total, show "Other" category
  if (categoryData.length === 0 && totalAmount > 0) {
    categoryData = [{
      name: 'Other',
      amount: totalAmount,
      percentage: 100,
      color: '#f59e0b',
      icon: '📦'
    }];
  }

  // Calculate angles only for categories with data (percentage > 0)
  const finalCategoryData: CategoryData[] = categoryData
    .filter(cat => cat.percentage > 0) // Only include categories with actual data
    .map(cat => {
      const angle = (cat.percentage / 100) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle += angle;
      return { ...cat, startAngle, endAngle };
    });

  // Animate categories when data changes - MUST be before conditional return
  useEffect(() => {
    if (finalCategoryData && finalCategoryData.length > 0) {
      finalCategoryData.forEach((_, index) => {
        Animated.timing(animatedValues[index], {
          toValue: 1,
          duration: 600,
          delay: index * 150,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [finalCategoryData]);

  // If no data, show empty state
  if (totalAmount === 0) {
    return (
      <Animated.View 
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{translateCategoryName('No expenses recorded', language as any)}</Text>
        </View>
      </Animated.View>
    );
  }

  const width = Dimensions.get('window').width - 32;
  const chartSize = Math.min(width, 240); // Reduced from 280 to 240
  const centerX = chartSize / 2;
  const centerY = chartSize / 2;
  const radius = 80; // Back to 80
  const innerRadius = 50; // Back to 50

  // Helper function to create arc path for donut chart
  const createArcPath = (startAngle: number, endAngle: number, outerRadius: number, innerRadius: number) => {
    const startAngleRad = (startAngle * Math.PI) / 180;
    const endAngleRad = (endAngle * Math.PI) / 180;
    
    // Outer arc
    const x1 = centerX + outerRadius * Math.cos(startAngleRad);
    const y1 = centerY + outerRadius * Math.sin(startAngleRad);
    const x2 = centerX + outerRadius * Math.cos(endAngleRad);
    const y2 = centerY + outerRadius * Math.sin(endAngleRad);
    
    // Inner arc (reversed)
    const x3 = centerX + innerRadius * Math.cos(endAngleRad);
    const y3 = centerY + innerRadius * Math.sin(endAngleRad);
    const x4 = centerX + innerRadius * Math.cos(startAngleRad);
    const y4 = centerY + innerRadius * Math.sin(startAngleRad);
    
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
    
    return `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4} Z`;
  };

  // Helper function to get label position
  const getLabelPosition = (angle: number, radius: number) => {
    const angleRad = (angle * Math.PI) / 180;
    const labelRadius = radius + 25; // Reduced from 50 to 25
    return {
      x: centerX + labelRadius * Math.cos(angleRad),
      y: centerY + labelRadius * Math.sin(angleRad),
    };
  };

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={styles.chartContainer}>
        {/* Background glow effect */}
        <View style={styles.backgroundGlow}>
          <LinearGradient
            colors={UI_CONSTANTS.CHART_GLOW_COLORS as any}
            style={styles.glowGradient}
          />
        </View>

        <Svg width={chartSize} height={chartSize} style={styles.svg}>
          <Defs>
            <Filter id="glow">
              <FeGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <FeMerge>
                <FeMergeNode in="coloredBlur"/>
                <FeMergeNode in="SourceGraphic"/>
              </FeMerge>
            </Filter>
          </Defs>
          
          {/* Background circle */}
          <Circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill={UI_CONSTANTS.CHART_BG_OUTER}
            stroke={UI_CONSTANTS.CHART_BG_OUTER_STROKE}
            strokeWidth="2"
          />
          
          {/* Inner circle */}
          <Circle
            cx={centerX}
            cy={centerY}
            r={innerRadius}
            fill={UI_CONSTANTS.CHART_BG_INNER}
            stroke={UI_CONSTANTS.CHART_BG_INNER_STROKE}
            strokeWidth="1"
          />

          {/* Category segments */}
          {finalCategoryData.map((category, index) => (
            <Path
              key={category.name}
              d={createArcPath(category.startAngle, category.endAngle, radius, innerRadius)}
              fill={category.color}
              fillOpacity={0.85}
              stroke="rgb(0, 0, 0)"
              strokeWidth="0.6"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
              filter="url(#glow)"
            />
          ))}

          {/* Labels */}
          {finalCategoryData.map((category, index) => {
            const midAngle = (category.startAngle + category.endAngle) / 2;
            const labelPos = getLabelPosition(midAngle, radius);
            
            // Skip labels for very small percentages to avoid overlapping
            if (category.percentage < 1) {
              return null;
            }
            
            // Skip every other label if there are too many categories
            if (finalCategoryData.length > 6 && index % 2 === 1 && category.percentage < 5) {
              return null;
            }
            
            
            // Adjust font size and position based on percentage to reduce overlapping
            const fontSize = category.percentage < 10 ? 10 : 14;
            const smallFontSize = category.percentage < 10 ? 8 : 10;
            const iconOffset = category.percentage < 10 ? -4 : -6;
            const textOffset = category.percentage < 10 ? 6 : 8;
            
            return (
              <G key={`label-${category.name}`}>
                <SvgText
                  x={labelPos.x}
                  y={labelPos.y + iconOffset}
                  fontSize={fontSize}
                  fontWeight="600"
                  fill="#E8EEF8"
                  textAnchor="middle"
                >
                  {category.icon}
                </SvgText>
                <SvgText
                  x={labelPos.x}
                  y={labelPos.y + textOffset}
                  fontSize={smallFontSize}
                  fontWeight="500"
                  fill="#9ca3af"
                  textAnchor="middle"
                >
                  {category.percentage.toFixed(0)}%
                </SvgText>
              </G>
            );
          })}

          {/* Center text */}
          <SvgText
            x={centerX }
            y={centerY + 2}
            fontSize="16"
            fontWeight="900"
            fill="#E8EEF8"
            textAnchor="middle"
          >
            {totalAmount.toFixed(2)} 
          </SvgText>
          <SvgText
            x={centerX}
            y={centerY + 18}
            fontSize="8"
            fontWeight="600"
            fill="#9ca3af"
            textAnchor="middle"
          >
            TOTALE
          </SvgText>
        </Svg>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  chartContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  backgroundGlow: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    borderRadius: 200,
    overflow: 'hidden',
  },
  glowGradient: {
    flex: 1,
    borderRadius: 200,
  },
  svg: {
    position: 'relative',
    zIndex: 1,
  },
  legend: {
    width: '100%',
    paddingHorizontal: 16,
  },
  legendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(6, 182, 212, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.15)',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 3,
  },
  legendIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  legendLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E8EEF8',
    textTransform: 'capitalize',
    letterSpacing: 0.3,
  },
  legendRight: {
    alignItems: 'flex-end',
  },
  legendAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#06b6d4',
    letterSpacing: -0.3,
  },
  legendPercentage: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
    marginTop: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    fontWeight: '500',
  },
});





