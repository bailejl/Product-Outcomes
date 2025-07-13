## Android Mobile App Guidance

Architecture & Design Patterns:

1. MVVM Architecture

   - ViewModel for UI state management
   - LiveData/StateFlow for reactive UI
   - Repository pattern for data layer
   - Clean Architecture principles

2. Modern Android Stack

   - Kotlin as primary language
   - Jetpack Compose for UI (or View system)
   - Coroutines for async operations
   - Hilt/Dagger for dependency injection

Core Technical Considerations:

1. Performance Optimization

   - Lazy loading and pagination
   - Image caching (Coil/Glide)
   - Background task optimization
   - Memory leak prevention (LeakCanary)
   - ProGuard/R8 for code optimization

2. UI/UX Best Practices

   - Material Design 3 guidelines
   - Responsive layouts for different screen sizes
   - Dark theme support
   - Accessibility features
   - Smooth animations (60fps)

3. Data Management

   - Room database for local storage
   - DataStore for preferences
   - WorkManager for background tasks
   - Retrofit for networking
   - Offline-first architecture

4. Security

   - Certificate pinning for APIs
   - Encrypted SharedPreferences
   - BiometricPrompt for authentication
   - No sensitive data in logs
   - Obfuscation with R8

5. Testing Strategy

   - Unit tests (JUnit, MockK)
   - UI tests (Espresso, Compose Testing)
   - Integration tests
   - CI/CD with GitHub Actions/Bitrise
   - Firebase Test Lab for device testing

6. Modern Features

   - App Bundles for smaller downloads
   - Dynamic Feature Modules
   - In-app updates
   - Play Core library integration
   - Kotlin Multiplatform (if targeting iOS too)

7. Analytics & Monitoring

   - Firebase Crashlytics
   - Firebase Analytics/Google Analytics
   - Performance Monitoring
   - A/B testing with Firebase
   - Play Console metrics

8. Development Tools

   - Android Studio (latest stable)
   - Gradle Version Catalog
   - Lint checks and custom rules
   - Baseline Profiles for performance
   - App Quality Insights

**Key Libraries/Dependencies**:
// Core
androidx.core:core-ktx
androidx.lifecycle:lifecycle-\*
androidx.activity:activity-compose

// UI
androidx.compose:compose-bom
com.google.android.material:material

// Networking
com.squareup.retrofit2:retrofit
com.squareup.okhttp3:okhttp

// Local Storage
androidx.room:room-\*
androidx.datastore:datastore

// DI
com.google.dagger:hilt-android

// Image Loading
io.coil-kt:coil-compose

## iOS Mobile App Guidance

Architecture & Design Patterns:

1. Modern Architecture

   - MVVM with Combine/async-await
   - Clean Architecture/VIPER for complex apps
   - Coordinator pattern for navigation
   - Repository pattern for data layer
   - Unidirectional data flow (TCA/Redux-like)

2. Modern iOS Stack

   - Swift as a primary language
   - SwiftUI for new UI (UIKit for legacy)
   - Combine framework for reactive programming
   - Swift Concurrency (async/await)
   - Swift Package Manager for dependencies

Core Technical Considerations:

1. Performance Optimization

   - Lazy loading in Lists/ScrollViews
   - Image caching (SDWebImage/Kingfisher)
   - Core Data batch operations
   - Instruments profiling
   - Memory graph debugging

2. UI/UX Best Practices

   - Human Interface Guidelines compliance
   - Dynamic Type for accessibility
   - Dark mode support
   - SF Symbols usage
   - Adaptive layouts (iPhone/iPad)
   - Smooth 60/120fps animations

3. Data Management

   - Core Data or SwiftData (iOS 17+)
   - UserDefaults with property wrappers
   - Keychain for secure storage
   - CloudKit for sync
   - Background refresh/processing

4. Security

   - Keychain Services for credentials
   - Certificate pinning
   - Biometric authentication (Face ID/Touch ID)
   - App Transport Security
   - Data Protection APIs

5. Testing Strategy

   - XCTest for unit testing
   - UI Testing with XCUITest
   - Snapshot testing
   - TestFlight for beta testing
   - Xcode Cloud for CI/CD
   - Performance testing with XCTest

6. Modern Features

   - App Clips
   - Widgets (WidgetKit)
   - Swift Charts for data visualization
   - WeatherKit/MapKit integration
   - Live Activities
   - SharePlay support

7. Analytics & Monitoring

   - MetricKit for performance metrics
   - Firebase/Analytics
   - Crashlytics or Sentry
   - App Store Connect Analytics
   - Custom OSLog implementation

8. Development Tools

   - Xcode (latest stable)
   - Swift Playgrounds for prototyping
   - Reality Composer (AR apps)
   - Instruments for profiling
   - Create ML for on-device ML

Key Dependencies/Frameworks:
// Apple Frameworks
import SwiftUI
import Combine
import CoreData/SwiftData
import Network
import StoreKit 2

// Common Third-Party
Alamofire // Networking
Kingfisher // Image loading
SwiftLint // Code quality
SnapKit // Auto Layout (UIKit)
Swinject // Dependency injection

SwiftUI Best Practices:
// Modern SwiftUI patterns
@StateObject for view models
@EnvironmentObject for shared state
@AppStorage for UserDefaults
.task for async operations
.refreshable for pull-to-refresh
NavigationStack for navigation

App Store Optimization:

- App thinning and bitcode
- On-demand resources
- Multiple app icons
- App Store screenshots/previews
- Proper metadata and keywords
- TestFlight beta testing

Platform Integration:

- Universal Links
- Handoff between devices
- iCloud sync
- Sign in with Apple
- Apple Pay integration
- HealthKit/HomeKit (if applicable)
