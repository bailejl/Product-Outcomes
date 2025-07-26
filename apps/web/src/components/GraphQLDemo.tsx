/**
 * GraphQL Demo Component
 * Demonstrates Apollo Client integration with React components
 */

import React, { useState } from 'react'
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Card,
  Input,
  InputField,
  Textarea,
  TextareaInput,
  Badge,
  Avatar,
  AvatarFallbackText,
  Heading,
  Divider,
  ScrollView,
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogCloseButton,
  AlertDialogBody,
  AlertDialogFooter,
} from '@gluestack-ui/themed'
import { useQuery, useMutation, useSubscription } from '@apollo/client'
import { GET_RECENT_MESSAGES, GET_ME, SEARCH_USERS } from '../graphql/queries'
import { CREATE_MESSAGE, UPDATE_MESSAGE, DELETE_MESSAGE } from '../graphql/mutations'
import { MESSAGE_ADDED, MESSAGE_UPDATED, MESSAGE_DELETED } from '../graphql/subscriptions'
import { GraphQLLoading, MessageListSkeleton, NetworkStatusIndicator } from './GraphQLLoading'
import { useAuth } from '../hooks/useGraphQL'

interface Message {
  id: string
  content: string
  createdAt: string
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    displayName?: string
  }
}

export function GraphQLDemo() {
  const [newMessage, setNewMessage] = useState('')
  const [editingMessage, setEditingMessage] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null)

  // GraphQL hooks
  const { user, isAuthenticated } = useAuth()
  
  const {
    data: messagesData,
    loading: messagesLoading,
    error: messagesError,
    refetch: refetchMessages,
    networkStatus,
  } = useQuery(GET_RECENT_MESSAGES, {
    variables: { limit: 20 },
    pollInterval: 30000, // Poll every 30 seconds
    notifyOnNetworkStatusChange: true,
  })

  const [createMessage, { loading: creating }] = useMutation(CREATE_MESSAGE, {
    update: (cache, { data }) => {
      if (data?.createMessage) {
        // Add optimistic update to cache
        const existing = cache.readQuery({
          query: GET_RECENT_MESSAGES,
          variables: { limit: 20 },
        })

        if (existing) {
          cache.writeQuery({
            query: GET_RECENT_MESSAGES,
            variables: { limit: 20 },
            data: {
              messages: {
                ...existing.messages,
                edges: [
                  { node: data.createMessage, cursor: data.createMessage.id },
                  ...existing.messages.edges,
                ],
              },
            },
          })
        }
      }
    },
    optimisticResponse: {
      createMessage: {
        id: `temp-${Date.now()}`,
        content: newMessage,
        createdAt: new Date().toISOString(),
        user: user || {
          id: 'temp-user',
          firstName: 'You',
          lastName: '',
          email: '',
          displayName: 'You',
        },
        __typename: 'Message',
      },
    },
  })

  const [updateMessage] = useMutation(UPDATE_MESSAGE, {
    optimisticResponse: (variables) => ({
      updateMessage: {
        id: variables.input.id,
        content: variables.input.content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isEdited: true,
        __typename: 'Message',
      },
    }),
  })

  const [deleteMessage] = useMutation(DELETE_MESSAGE, {
    update: (cache, { data }, { variables }) => {
      if (data?.deleteMessage.success && variables?.id) {
        cache.evict({ id: `Message:${variables.id}` })
        cache.gc()
      }
    },
  })

  // Real-time subscriptions
  useSubscription(MESSAGE_ADDED, {
    onData: ({ data }) => {
      if (data.data?.messageAdded) {
        // Message will be automatically added to cache via subscription
        console.log('New message received:', data.data.messageAdded)
      }
    },
  })

  useSubscription(MESSAGE_UPDATED, {
    onData: ({ data }) => {
      if (data.data?.messageUpdated) {
        console.log('Message updated:', data.data.messageUpdated)
      }
    },
  })

  useSubscription(MESSAGE_DELETED, {
    onData: ({ data }) => {
      if (data.data?.messageDeleted) {
        console.log('Message deleted:', data.data.messageDeleted)
      }
    },
  })

  const handleCreateMessage = async () => {
    if (!newMessage.trim() || !isAuthenticated) return

    try {
      await createMessage({
        variables: {
          input: { content: newMessage },
        },
      })
      setNewMessage('')
    } catch (error) {
      console.error('Failed to create message:', error)
    }
  }

  const handleUpdateMessage = async (id: string) => {
    if (!editContent.trim()) return

    try {
      await updateMessage({
        variables: {
          input: { id, content: editContent },
        },
      })
      setEditingMessage(null)
      setEditContent('')
    } catch (error) {
      console.error('Failed to update message:', error)
    }
  }

  const handleDeleteMessage = async (id: string) => {
    try {
      await deleteMessage({
        variables: { id },
      })
      setShowDeleteDialog(null)
    } catch (error) {
      console.error('Failed to delete message:', error)
    }
  }

  const messages = messagesData?.messages?.edges?.map(edge => edge.node) || []

  if (messagesLoading && !messages.length) {
    return <MessageListSkeleton count={5} />
  }

  return (
    <Box flex={1} p="$4">
      <VStack space="lg">
        {/* Header */}
        <Card p="$4" variant="outline">
          <VStack space="md">
            <Heading size="lg">GraphQL Demo - Real-time Messages</Heading>
            <Text fontSize="$sm" color="$textLight600">
              This component demonstrates Apollo Client integration with queries, mutations, 
              subscriptions, optimistic updates, and cache management.
            </Text>
            <NetworkStatusIndicator 
              networkStatus={networkStatus} 
              error={messagesError} 
            />
          </VStack>
        </Card>

        {/* Create Message */}
        {isAuthenticated && (
          <Card p="$4" variant="outline">
            <VStack space="md">
              <Heading size="md">Create New Message</Heading>
              <Textarea
                size="md"
                isDisabled={creating}
              >
                <TextareaInput
                  placeholder="Type your message here..."
                  value={newMessage}
                  onChangeText={setNewMessage}
                />
              </Textarea>
              <HStack space="sm" justifyContent="flex-end">
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => setNewMessage('')}
                  isDisabled={creating || !newMessage.trim()}
                >
                  <Text>Clear</Text>
                </Button>
                <Button
                  size="sm"
                  onPress={handleCreateMessage}
                  isDisabled={creating || !newMessage.trim()}
                >
                  <Text>{creating ? 'Sending...' : 'Send Message'}</Text>
                </Button>
              </HStack>
            </VStack>
          </Card>
        )}

        {/* Messages List */}
        <Card flex={1} variant="outline">
          <VStack space="md" p="$4">
            <HStack justifyContent="space-between" alignItems="center">
              <Heading size="md">Recent Messages</Heading>
              <HStack space="sm">
                <Badge variant="outline" size="sm">
                  <Text>{messages.length} messages</Text>
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => refetchMessages()}
                >
                  <Text>Refresh</Text>
                </Button>
              </HStack>
            </HStack>

            <Divider />

            <ScrollView flex={1} showsVerticalScrollIndicator={false}>
              <VStack space="md">
                {messages.length === 0 ? (
                  <Box p="$8" alignItems="center">
                    <Text color="$textLight400" textAlign="center">
                      No messages yet. {isAuthenticated ? 'Be the first to send one!' : 'Please log in to send messages.'}
                    </Text>
                  </Box>
                ) : (
                  messages.map((message: Message) => (
                    <Card key={message.id} p="$4" variant="elevated">
                      <VStack space="sm">
                        <HStack space="sm" alignItems="center" justifyContent="space-between">
                          <HStack space="sm" alignItems="center" flex={1}>
                            <Avatar size="sm">
                              <AvatarFallbackText>
                                {message.user.firstName[0]}{message.user.lastName[0]}
                              </AvatarFallbackText>
                            </Avatar>
                            <VStack flex={1}>
                              <Text fontSize="$sm" fontWeight="$semibold">
                                {message.user.displayName || `${message.user.firstName} ${message.user.lastName}`}
                              </Text>
                              <Text fontSize="$xs" color="$textLight500">
                                {new Date(message.createdAt).toLocaleString()}
                              </Text>
                            </VStack>
                          </HStack>

                          {/* Action buttons for message author */}
                          {isAuthenticated && user?.id === message.user.id && (
                            <HStack space="xs">
                              <Button
                                size="xs"
                                variant="outline"
                                onPress={() => {
                                  setEditingMessage(message.id)
                                  setEditContent(message.content)
                                }}
                              >
                                <Text>Edit</Text>
                              </Button>
                              <Button
                                size="xs"
                                action="negative"
                                variant="outline"
                                onPress={() => setShowDeleteDialog(message.id)}
                              >
                                <Text>Delete</Text>
                              </Button>
                            </HStack>
                          )}
                        </HStack>

                        {/* Message content */}
                        {editingMessage === message.id ? (
                          <VStack space="sm">
                            <Textarea size="sm">
                              <TextareaInput
                                value={editContent}
                                onChangeText={setEditContent}
                                placeholder="Edit your message..."
                              />
                            </Textarea>
                            <HStack space="sm" justifyContent="flex-end">
                              <Button
                                size="xs"
                                variant="outline"
                                onPress={() => {
                                  setEditingMessage(null)
                                  setEditContent('')
                                }}
                              >
                                <Text>Cancel</Text>
                              </Button>
                              <Button
                                size="xs"
                                onPress={() => handleUpdateMessage(message.id)}
                              >
                                <Text>Save</Text>
                              </Button>
                            </HStack>
                          </VStack>
                        ) : (
                          <Text fontSize="$sm">{message.content}</Text>
                        )}
                      </VStack>
                    </Card>
                  ))
                )}
              </VStack>
            </ScrollView>
          </VStack>
        </Card>

        {/* GraphQL Features Info */}
        <Card p="$4" variant="outline">
          <VStack space="md">
            <Heading size="md">Apollo Client Features Demonstrated</Heading>
            <VStack space="sm">
              <HStack space="sm" alignItems="center">
                <Text fontSize="$xs">✅</Text>
                <Text fontSize="$sm">Query with polling and caching</Text>
              </HStack>
              <HStack space="sm" alignItems="center">
                <Text fontSize="$xs">✅</Text>
                <Text fontSize="$sm">Mutations with optimistic updates</Text>
              </HStack>
              <HStack space="sm" alignItems="center">
                <Text fontSize="$xs">✅</Text>
                <Text fontSize="$sm">Real-time subscriptions</Text>
              </HStack>
              <HStack space="sm" alignItems="center">
                <Text fontSize="$xs">✅</Text>
                <Text fontSize="$sm">Cache management and updates</Text>
              </HStack>
              <HStack space="sm" alignItems="center">
                <Text fontSize="$xs">✅</Text>
                <Text fontSize="$sm">Error handling and loading states</Text>
              </HStack>
              <HStack space="sm" alignItems="center">
                <Text fontSize="$xs">✅</Text>
                <Text fontSize="$sm">Network status monitoring</Text>
              </HStack>
            </VStack>
          </VStack>
        </Card>
      </VStack>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={!!showDeleteDialog}
        onClose={() => setShowDeleteDialog(null)}
      >
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <Heading size="md">Delete Message</Heading>
            <AlertDialogCloseButton />
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text>Are you sure you want to delete this message? This action cannot be undone.</Text>
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onPress={() => setShowDeleteDialog(null)}
              mr="$2"
            >
              <Text>Cancel</Text>
            </Button>
            <Button
              action="negative"
              onPress={() => showDeleteDialog && handleDeleteMessage(showDeleteDialog)}
            >
              <Text>Delete</Text>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  )
}