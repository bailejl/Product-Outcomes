import React, { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  ButtonText,
  Avatar,
  AvatarBadge,
  AvatarFallbackText,
  Menu,
  MenuItem,
  MenuItemLabel,
  Pressable,
  Divider,
} from '@gluestack-ui/themed'
import { ChevronDownIcon, UserIcon, SettingsIcon, LogOutIcon } from '@gluestack-ui/themed'

export function UserMenu() {
  const { state, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  if (!state.isAuthenticated || !state.user) {
    return null
  }

  const handleLogout = async () => {
    try {
      await logout()
      setIsOpen(false)
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const userInitials = `${state.user.firstName[0] || ''}${state.user.lastName[0] || ''}`.toUpperCase() || state.user.email[0].toUpperCase()
  
  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrator'
      case 'moderator':
        return 'Moderator'
      case 'user':
      default:
        return 'User'
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return '$error500'
      case 'moderator':
        return '$warning500'
      case 'user':
      default:
        return '$primary500'
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setIsOpen(!isOpen)
    }
  }

  return (
    <Box position="relative" ref={menuRef}>
      <Pressable
        onPress={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        borderRadius="$md"
        p="$2"
        _hover={{
          bg: '$secondary100',
        }}
        _focus={{
          bg: '$secondary100',
          borderColor: '$primary500',
          borderWidth: 2,
        }}
        testID="user-menu"
        accessibilityRole="button"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <HStack space="$2" alignItems="center">
          <Avatar size="sm" bg={getRoleBadgeColor(state.user.role)}>
            <AvatarFallbackText fontWeight="$medium" color="$white">
              {userInitials}
            </AvatarFallbackText>
            <AvatarBadge bg={getRoleBadgeColor(state.user.role)} borderColor="$white" borderWidth={2} />
          </Avatar>
          
          <VStack space="$0">
            <Text size="sm" fontWeight="$medium" color="$secondary700">
              {state.user.firstName} {state.user.lastName}
            </Text>
            <Text size="xs" color="$secondary500">
              {getRoleDisplayName(state.user.role)}
            </Text>
          </VStack>
          
          <ChevronDownIcon 
            size="sm" 
            color="$secondary400" 
            style={{
              transform: isOpen ? [{ rotate: '180deg' }] : [{ rotate: '0deg' }],
              transition: 'transform 200ms ease',
            }}
          />
        </HStack>
      </Pressable>

      {isOpen && (
        <Box
          position="absolute"
          right={0}
          top="$full"
          mt="$2"
          w="$48"
          bg="$white"
          borderRadius="$md"
          shadowColor="$black"
          shadowOffset={{ width: 0, height: 4 }}
          shadowOpacity={0.1}
          shadowRadius={8}
          borderColor="$secondary200"
          borderWidth={1}
          py="$1"
          zIndex={50}
        >
          <VStack space="$0">
            <Box px="$4" py="$2" borderBottomColor="$secondary100" borderBottomWidth={1}>
              <VStack space="$1">
                <Text size="sm" fontWeight="$medium" color="$secondary900">
                  {state.user.firstName} {state.user.lastName}
                </Text>
                <Text size="sm" color="$secondary500">
                  {state.user.email}
                </Text>
                <HStack space="$2" alignItems="center">
                  <Box
                    bg={getRoleBadgeColor(state.user.role)}
                    px="$2"
                    py="$1"
                    borderRadius="$full"
                  >
                    <Text size="xs" color="$white" fontWeight="$medium">
                      {getRoleDisplayName(state.user.role)}
                    </Text>
                  </Box>
                  {state.user.emailVerified && (
                    <Box bg="$success500" px="$2" py="$1" borderRadius="$full">
                      <Text size="xs" color="$white" fontWeight="$medium">
                        Verified
                      </Text>
                    </Box>
                  )}
                </HStack>
              </VStack>
            </Box>

            <Pressable
              onPress={() => {
                setIsOpen(false)
                // TODO: Implement profile view
                console.log('View profile clicked')
              }}
              px="$4"
              py="$2"
              _hover={{
                bg: '$secondary50',
              }}
              testID="user-menu-profile"
            >
              <HStack space="$3" alignItems="center">
                <UserIcon size="sm" color="$secondary700" />
                <Text size="sm" color="$secondary700">
                  View Profile
                </Text>
              </HStack>
            </Pressable>

            <Pressable
              onPress={() => {
                setIsOpen(false)
                // TODO: Implement settings
                console.log('Settings clicked')
              }}
              px="$4"
              py="$2"
              _hover={{
                bg: '$secondary50',
              }}
              testID="user-menu-settings"
            >
              <HStack space="$3" alignItems="center">
                <SettingsIcon size="sm" color="$secondary700" />
                <Text size="sm" color="$secondary700">
                  Settings
                </Text>
              </HStack>
            </Pressable>

            <Divider my="$1" />

            <Pressable
              onPress={handleLogout}
              px="$4"
              py="$2"
              _hover={{
                bg: '$error50',
              }}
              testID="user-menu-logout"
            >
              <HStack space="$3" alignItems="center">
                <LogOutIcon size="sm" color="$error600" />
                <Text size="sm" color="$error600">
                  Sign Out
                </Text>
              </HStack>
            </Pressable>
          </VStack>
        </Box>
      )}
    </Box>
  )
}
