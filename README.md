# TravelSync Mobile

> Standalone React Native & Expo mobile application for **TravelSync - Group Trip Planner**.  
> Connects directly to the existing TravelSync Express.js backend, PostgreSQL (Prisma) database, and Firebase Authentication identity system.

---

## 🏗 Architecture & Design

TravelSync Mobile is developed as an **independent project** that co-exists with the TravelSync web application without modifying or duplicating backend services or database schemas.

```
┌────────────────────────────────┐       ┌────────────────────────────────┐
│      TravelSync Mobile         │       │        TravelSync Web          │
│  (React Native / Expo / TS)    │       │     (Vue 3 / Vite / Pinia)     │
└──────────────┬─────────────────┘       └──────────────┬─────────────────┘
               │                                        │
               │  Bearer <Firebase_ID_Token>            │
               ▼                                        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      TravelSync Express Backend                        │
│                 (/api/auth, /api/trips, /api/explore)                  │
├──────────────────────────────────┬─────────────────────────────────────┤
│      Firebase Admin SDK          │          Prisma ORM (PostgreSQL)    │
│  (Token verification & decode)   │     (Users, Trips, Places, Expenses)│
└──────────────────────────────────┴─────────────────────────────────────┘
```

### Key Architectural Tenets
1. **Shared Firebase Identity**: Authentication utilizes Firebase Auth tokens. The backend's `verifyToken` middleware (`verifyAuthToken.js`) validates ID tokens and automatically links/provisions the user in the PostgreSQL `users` table upon initial login.
2. **Online-First & Resilient**: Built with TanStack Query (`@tanstack/react-query`) for cached server state, automatic background re-validation, mutation invalidation, and explicit error/loading states.
3. **Android-First Host Resolution**: Default networking resolves `http://10.0.2.2:3000/api` on Android emulators and `http://localhost:3000/api` on iOS/web, fully configurable via `EXPO_PUBLIC_API_URL`.
4. **Token Interceptor & Refresh**: Axios client automatically attaches fresh Firebase ID tokens and handles 401 expiration retry with force-refresh.

---

## 📱 Features

- **Authentication Flow**:
  - Email/Password login and registration.
  - Integration with Firebase Authentication & backend user synchronization (`GET /api/auth/me`).
  - Clear user alerts for unverified emails (`EMAIL_NOT_VERIFIED` HTTP 403).
- **Dashboard**:
  - Live statistics: Total Trips, Upcoming Trips, Co-Travelers, and Total Spent.
  - Trips list with status badges (`planning`, `upcoming`, `completed`, `cancelled`), destination, and cover photos.
  - Pull-to-refresh with animated loading indicators.
  - Empty states with CTA to plan new trips.
- **Trip Details & Itinerary**:
  - Day-by-day itinerary schedule (Day 1, Day 2, etc.).
  - Place cards showing category, duration, address, and notes.
  - Add Place modal: Create stops with day assignment and duration.
  - Delete stops from itinerary with confirmation dialog.
  - Overview tab with budget, members list, and logged expenses.
- **Trip Creation**:
  - Create trip modal with name, destination, start/end dates, budget per person, and currency.
- **Account & Backend Health**:
  - Profile screen displaying PostgreSQL User ID, Firebase UID, Email verification status, and active API base URL.
  - Manual "Refresh Backend Sync" and Sign Out.

---

## 🛠 Tech Stack

- **Framework**: React Native 0.88, Expo SDK 58
- **Language**: TypeScript with strict mode (`strict: true`)
- **Navigation**: Expo Router (file-based routing with typed routes)
- **Data Fetching & State**: TanStack Query (`@tanstack/react-query`)
- **HTTP Client**: Axios with custom Firebase token interceptors
- **Authentication**: Firebase Modular SDK with `@react-native-async-storage/async-storage` persistence
- **Icons**: `@expo/vector-icons` (Ionicons)
- **Image Optimization**: `expo-image`

---

## ⚙️ Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` to match your development environment:

```env
# Backend API Base URL
# - Android Emulator: http://10.0.2.2:3000/api (default)
# - Physical Android Device: http://<YOUR_COMPUTER_LAN_IP>:3000/api (e.g. http://192.168.1.100:3000/api)
# - Deployed Production Backend: https://your-backend.onrender.com/api
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api

# Firebase Configuration (Matches existing TravelSync Firebase project)
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
```

> **Tip**: You can find your Firebase credentials in the web project's `client/.env` or in Firebase Console → Project Settings → General → Web apps.

---

## 🚀 Running on Android

### 1. Start the TravelSync Backend Server
Make sure your existing backend server is running:
```bash
cd /path/to/TravelSync/server
npm run dev
# Server will listen on http://localhost:3000
```

### 2. Run on Android Emulator
Ensure an Android Virtual Device (AVD) is running from Android Studio, then run:
```bash
npm run android
```
The app will automatically communicate with `http://10.0.2.2:3000/api` (the Android emulator loopback to your development host).

### 3. Run on a Physical Android Phone with Expo Go
1. Install **Expo Go** from Google Play Store on your Android phone.
2. Ensure both your computer and phone are connected to the same Wi-Fi network.
3. Find your computer's local LAN IP (e.g., `192.168.1.50`).
4. In `.env`, set:
   ```env
   EXPO_PUBLIC_API_URL=http://192.168.1.50:3000/api
   ```
5. Ensure your backend's `ALLOWED_ORIGIN` includes non-browser traffic (standard Express CORS allows this).
6. Start Expo:
   ```bash
   npx expo start
   ```
7. Scan the QR code with the Expo Go app.

---

## 🧪 Quality Gates & Verification

Run type checking and linting anytime before committing:

```bash
# Strict TypeScript check (0 errors)
npx tsc --noEmit

# ESLint validation (0 errors)
npm run lint
```

---

## 📂 Project Structure

```
Travelsync-mobile/
├── .env.example              # Sample environment variables
├── .env                      # Local environment configuration
├── app.json                  # Expo application manifest
├── package.json              # Dependency manifests
├── tsconfig.json             # TypeScript configuration
├── src/
│   ├── api/
│   │   ├── client.ts         # Axios client with Firebase token interceptor & 401 retry
│   │   ├── auth.ts           # /api/auth/me user profile endpoints
│   │   └── trips.ts          # /api/trips, /places, /summary endpoints
│   ├── config/
│   │   ├── env.ts            # Dynamic API base URL & Firebase configs
│   │   └── firebase.ts       # Firebase app & auth with AsyncStorage persistence
│   ├── types/
│   │   ├── auth.ts           # User & Auth interfaces
│   │   └── trip.ts           # Trip, Place, Expense, Summary interfaces
│   ├── context/
│   │   └── AuthContext.tsx   # Firebase session listener & backend user synchronizer
│   ├── hooks/
│   │   ├── useTrips.ts       # TanStack Query hooks for trips & dashboard stats
│   │   └── useTripDetails.ts # TanStack Query hooks for trip detail, itinerary & places
│   ├── components/
│   │   ├── common/           # Button, Input, Card, LoadingState, ErrorState, EmptyState
│   │   └── trips/            # TripCard, StatCard, PlaceCard
│   └── app/                  # Expo Router file-based routes
│       ├── _layout.tsx       # Root QueryClient & Auth providers
│       ├── (auth)/
│       │   ├── _layout.tsx   # Auth stack
│       │   ├── login.tsx     # Sign In screen
│       │   └── register.tsx  # Register screen
│       ├── (tabs)/
│       │   ├── _layout.tsx   # Bottom tabs
│       │   ├── index.tsx     # Dashboard & Trips screen
│       │   └── profile.tsx   # Profile & backend connection info
│       ├── trip/
│       │   ├── [id].tsx      # Itinerary & Trip details screen
│       │   └── create.tsx    # Plan new trip modal
│       └── index.tsx         # Redirect to /(tabs)
```

---

## 🗺️ Google Maps API Setup (iOS & Android)

TravelSync Mobile features an interactive map planner using `react-native-maps` on native devices with a responsive fallback on Web.

To enable native Google Maps:
1. Obtain a Google Maps API Key from the [Google Cloud Console](https://console.cloud.google.com/google/maps-apis).
2. Enable **Maps SDK for Android** and **Maps SDK for iOS**.
3. Add your API key to your local `.env` file:
   ```env
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
   ```
4. The key is automatically configured in `app.json` under:
   - `expo.ios.config.googleMapsApiKey`
   - `expo.android.config.googleMaps.apiKey`
