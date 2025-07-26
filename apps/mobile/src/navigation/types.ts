import { NavigatorScreenParams } from '@react-navigation/native';

// Auth Stack Navigator Types
export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token: string };
  VerifyEmail: { email: string };
};

// Main Tab Navigator Types
export type MainTabParamList = {
  Dashboard: undefined;
  OKRs: undefined;
  Teams: undefined;
  Profile: undefined;
};

// Settings Stack Navigator Types
export type SettingsStackParamList = {
  SettingsHome: undefined;
  Account: undefined;
  Notifications: undefined;
  Privacy: undefined;
  Security: undefined;
  About: undefined;
};

// Root Stack Navigator Types
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  Settings: NavigatorScreenParams<SettingsStackParamList>;
  Modal: { title: string; content: string };
};

// Screen Props Types
export type ScreenProps<T extends keyof RootStackParamList> = {
  route: { params: RootStackParamList[T] };
  navigation: any;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}