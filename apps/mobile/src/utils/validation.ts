import * as yup from 'yup';
import { PasswordStrength } from '../types/auth.types';

// Password strength calculation
export const calculatePasswordStrength = (password: string): PasswordStrength => {
  if (!password) {
    return {
      score: 0,
      feedback: ['Password is required'],
      isValid: false,
    };
  }

  let score = 0;
  const feedback: string[] = [];

  // Length check
  if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push('Password must be at least 8 characters long');
  }

  // Uppercase letter
  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Add at least one uppercase letter');
  }

  // Lowercase letter
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Add at least one lowercase letter');
  }

  // Number
  if (/\d/.test(password)) {
    score += 1;
  } else {
    feedback.push('Add at least one number');
  }

  // Special character
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Add at least one special character');
  }

  // Additional length bonus
  if (password.length >= 12) {
    score += 1;
  }

  // Check for common patterns
  const commonPatterns = [
    /(.)\1{2,}/, // Repeated characters
    /123456|abcdef|qwerty/i, // Common sequences
  ];

  commonPatterns.forEach(pattern => {
    if (pattern.test(password)) {
      score = Math.max(0, score - 1);
      if (!feedback.includes('Avoid common patterns or repeated characters')) {
        feedback.push('Avoid common patterns or repeated characters');
      }
    }
  });

  return {
    score: Math.min(score, 5),
    feedback: feedback.length === 0 ? ['Strong password!'] : feedback,
    isValid: score >= 4,
  };
};

// Validation schemas
export const loginSchema = yup.object().shape({
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required'),
  password: yup
    .string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
  rememberMe: yup.boolean().optional(),
});

export const registerSchema = yup.object().shape({
  firstName: yup
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be less than 50 characters')
    .matches(/^[a-zA-Z\s]+$/, 'First name can only contain letters and spaces')
    .required('First name is required'),
  lastName: yup
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be less than 50 characters')
    .matches(/^[a-zA-Z\s]+$/, 'Last name can only contain letters and spaces')
    .required('Last name is required'),
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required'),
  password: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .test('password-strength', 'Password is not strong enough', function(value) {
      if (!value) return false;
      const strength = calculatePasswordStrength(value);
      return strength.isValid;
    })
    .required('Password is required'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password')], 'Passwords must match')
    .required('Please confirm your password'),
  role: yup
    .string()
    .oneOf(['ADMIN', 'MANAGER', 'EMPLOYEE', 'GUEST'], 'Please select a valid role')
    .required('Role is required'),
  acceptTerms: yup
    .boolean()
    .oneOf([true], 'You must accept the terms and conditions')
    .required('You must accept the terms and conditions'),
});

export const forgotPasswordSchema = yup.object().shape({
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required'),
});

export const resetPasswordSchema = yup.object().shape({
  token: yup.string().required('Reset token is required'),
  password: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .test('password-strength', 'Password is not strong enough', function(value) {
      if (!value) return false;
      const strength = calculatePasswordStrength(value);
      return strength.isValid;
    })
    .required('Password is required'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password')], 'Passwords must match')
    .required('Please confirm your password'),
});

export const changePasswordSchema = yup.object().shape({
  currentPassword: yup
    .string()
    .required('Current password is required'),
  newPassword: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .test('password-strength', 'Password is not strong enough', function(value) {
      if (!value) return false;
      const strength = calculatePasswordStrength(value);
      return strength.isValid;
    })
    .test('different-password', 'New password must be different from current password', function(value) {
      const { currentPassword } = this.parent;
      return value !== currentPassword;
    })
    .required('New password is required'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('newPassword')], 'Passwords must match')
    .required('Please confirm your new password'),
});

// Utility functions
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

export const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
};

export const validatePasswordMatch = (password: string, confirmPassword: string): boolean => {
  return password === confirmPassword;
};

export const getPasswordStrengthColor = (score: number): string => {
  switch (score) {
    case 0:
    case 1:
      return '#dc2626'; // red
    case 2:
      return '#f59e0b'; // amber
    case 3:
      return '#eab308'; // yellow
    case 4:
      return '#84cc16'; // lime
    case 5:
      return '#22c55e'; // green
    default:
      return '#6b7280'; // gray
  }
};

export const getPasswordStrengthText = (score: number): string => {
  switch (score) {
    case 0:
    case 1:
      return 'Very Weak';
    case 2:
      return 'Weak';
    case 3:
      return 'Fair';
    case 4:
      return 'Good';
    case 5:
      return 'Strong';
    default:
      return 'Unknown';
  }
};