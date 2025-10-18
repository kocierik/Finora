# Finora 💳

**Your Personal Financial Future - Track expenses, manage budgets, and achieve your financial goals with ease.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Expo](https://img.shields.io/badge/Expo-000020.svg?style=flat&logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactnative.dev)

## 📱 Description

Finora is a modern, intuitive personal finance app built with React Native and Expo. It helps you track your daily expenses, categorize spending, set budgets, and visualize your financial habits through beautiful charts and analytics. Whether you're managing your monthly budget or planning for long-term financial goals, Finora provides the tools you need to take control of your money.

## ✨ Features

- **📊 Smart Expense Tracking** - Automatically sync expenses from Google Wallet notifications
- **🏷️ Intelligent Categorization** - Auto-assign categories based on merchant patterns
- **📈 Visual Analytics** - Beautiful pie charts and spending trends
- **💰 Budget Management** - Set monthly budgets and track progress
- **🌙 Dark Theme** - Modern, eye-friendly interface
- **🔄 Real-time Sync** - Cloud-based data synchronization with Supabase
- **📱 Cross-platform** - Works on iOS and Android
- **🔐 Secure** - End-to-end encryption and secure authentication
- **🌍 Multi-language** - Support for English and Italian
- **📊 Monthly Reports** - Detailed spending analysis and insights

## 🚀 Installation

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator (for iOS development) or Android Studio (for Android development)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/finora.git
   cd finora
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Start the development server**
   ```bash
   npx expo start
   ```

4. **Run on your preferred platform**
   - **iOS Simulator**: Press `i` in the terminal or scan QR code with Expo Go
   - **Android Emulator**: Press `a` in the terminal or scan QR code with Expo Go
   - **Physical Device**: Install Expo Go and scan the QR code

## 📖 Usage

### Getting Started

1. **Sign Up** - Create your account with email or Google authentication
2. **Complete Onboarding** - Set up your preferences and categories
3. **Add Expenses** - Manually add expenses or enable Google Wallet sync
4. **Categorize** - Assign categories to your transactions
5. **Analyze** - View your spending patterns and budget progress

### Key Features

#### Expense Tracking
- Add expenses manually with merchant, amount, and date
- Enable Google Wallet integration for automatic expense detection
- Categorize transactions for better organization

#### Budget Management
- Set monthly spending limits
- Track progress with visual indicators
- Receive alerts when approaching budget limits

#### Analytics
- View spending by category with interactive pie charts
- Compare monthly spending trends
- Export data for external analysis

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# App Configuration
EXPO_PUBLIC_APP_NAME=Finora
EXPO_PUBLIC_APP_VERSION=1.0.0
```

### Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the SQL migrations in the `migrations/` directory
3. Set up Row Level Security (RLS) policies
4. Configure authentication providers

### Google Wallet Integration

1. Enable Google Wallet API in Google Cloud Console
2. Configure OAuth 2.0 credentials
3. Set up notification permissions in your app

## 🛠️ Development

### Project Structure

```
finora/
├── app/                    # App screens and navigation
├── components/             # Reusable UI components
├── constants/              # App constants and configuration
├── context/                # React Context providers
├── hooks/                  # Custom React hooks
├── lib/                    # External library configurations
├── services/               # Business logic and API calls
├── types/                  # TypeScript type definitions
└── assets/                 # Images, fonts, and other assets
```

### Available Scripts

```bash
# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Build for production
npm run build

# Reset project (clean slate)
npm run reset-project
```

### Code Style

This project uses:
- **ESLint** for code linting
- **Prettier** for code formatting
- **TypeScript** for type safety
- **Expo Router** for navigation

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add some amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines

- Follow the existing code style and patterns
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Contact & Support

- **Email**: finorasupport@gmail.com
- **Issues**: [GitHub Issues](https://github.com/kocierik/finora/issues)
- **Discussions**: [GitHub Discussions](https://github.com/kocierik/finora/discussions)

## 🙏 Acknowledgments

- [Expo](https://expo.dev) for the amazing development platform
- [Supabase](https://supabase.com) for backend services
- [React Native](https://reactnative.dev) for cross-platform development
- [Expo Router](https://expo.github.io/router) for navigation

---

**Made with ❤️ for better financial management**