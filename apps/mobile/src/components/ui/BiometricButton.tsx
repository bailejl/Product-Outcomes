import React from 'react';
import { Platform, Alert } from 'react-native';
import { 
  Button, 
  ButtonText, 
  ButtonIcon, 
  HStack, 
  Text 
} from '@gluestack-ui/themed';
import { BiometricConfig } from '../../types/auth.types';

interface BiometricButtonProps {
  biometricConfig: BiometricConfig;
  onPress: () => Promise<void>;
  isLoading?: boolean;
  variant?: 'solid' | 'outline' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const BiometricButton: React.FC<BiometricButtonProps> = ({
  biometricConfig,
  onPress,
  isLoading = false,
  variant = 'outline',
  size = 'md',
  showLabel = true,
}) => {
  const getBiometricIcon = () => {
    if (Platform.OS === 'ios') {
      return biometricConfig.biometryType === 'FaceID' ? '👤' : '👆';
    }
    return '🔒';
  };

  const getBiometricLabel = () => {
    if (Platform.OS === 'ios') {
      return biometricConfig.biometryType === 'FaceID' 
        ? 'Sign in with Face ID' 
        : 'Sign in with Touch ID';
    }
    return 'Sign in with Fingerprint';
  };

  const handlePress = async () => {
    if (!biometricConfig.isAvailable) {
      Alert.alert(
        'Biometric Authentication Unavailable',
        'This device does not support biometric authentication or it is not set up.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!biometricConfig.isEnabled) {
      Alert.alert(
        'Biometric Authentication Disabled',
        'Please enable biometric authentication in settings to use this feature.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      await onPress();
    } catch (error) {
      Alert.alert(
        'Authentication Failed',
        error instanceof Error ? error.message : 'Biometric authentication failed',
        [{ text: 'OK' }]
      );
    }
  };

  if (!biometricConfig.isAvailable || !biometricConfig.isEnabled) {
    return null;
  }

  return (
    <Button
      variant={variant}
      size={size}
      onPress={handlePress}
      isDisabled={isLoading}
      borderColor="$primary500"
      borderWidth={variant === 'outline' ? 1 : 0}
    >
      <HStack alignItems="center" space="sm">
        <Text style={{ fontSize: 20 }}>
          {getBiometricIcon()}
        </Text>
        {showLabel && (
          <ButtonText color={variant === 'solid' ? '$white' : '$primary500'}>
            {isLoading ? 'Authenticating...' : getBiometricLabel()}
          </ButtonText>
        )}
      </HStack>
    </Button>
  );
};