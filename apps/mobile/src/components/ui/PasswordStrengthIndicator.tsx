import React from 'react';
import { View, Text } from 'react-native';
import { Box, Progress, ProgressFilledTrack, VStack, HStack } from '@gluestack-ui/themed';
import { PasswordStrength } from '../../types/auth.types';
import { getPasswordStrengthColor, getPasswordStrengthText } from '../../utils/validation';

interface PasswordStrengthIndicatorProps {
  strength: PasswordStrength;
  showFeedback?: boolean;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  strength,
  showFeedback = true,
}) => {
  const strengthPercentage = (strength.score / 5) * 100;
  const strengthColor = getPasswordStrengthColor(strength.score);
  const strengthText = getPasswordStrengthText(strength.score);

  return (
    <VStack space="xs">
      <HStack justifyContent="space-between" alignItems="center">
        <Text style={{ fontSize: 12, color: '#6b7280' }}>
          Password Strength
        </Text>
        <Text 
          style={{ 
            fontSize: 12, 
            color: strengthColor,
            fontWeight: '600',
          }}
        >
          {strengthText}
        </Text>
      </HStack>
      
      <Box width="100%" height={4} backgroundColor="#e5e7eb" borderRadius={2}>
        <Box
          width={`${strengthPercentage}%`}
          height="100%"
          backgroundColor={strengthColor}
          borderRadius={2}
          style={{
            transition: 'all 0.3s ease',
          }}
        />
      </Box>

      {showFeedback && strength.feedback.length > 0 && (
        <VStack space="xs" marginTop="xs">
          {strength.feedback.map((feedback, index) => (
            <HStack key={index} alignItems="center" space="xs">
              <Box
                width={4}
                height={4}
                borderRadius={2}
                backgroundColor={strength.isValid ? '#22c55e' : '#f59e0b'}
              />
              <Text style={{ fontSize: 11, color: '#6b7280', flex: 1 }}>
                {feedback}
              </Text>
            </HStack>
          ))}
        </VStack>
      )}
    </VStack>
  );
};